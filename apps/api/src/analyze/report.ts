import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../env.js';
import type { NormalizedItem } from '../collect/normalize.js';
import { redactSensitive } from '../collect/pii.js';
import type { BudgetTracker } from './budget.js';

/**
 * 활용 관점(usage angle) 분석 — 수집된 공개 출처를 Claude로 정제해
 * "핵심 정보 요약 + 관점별 활용 리포트"를 생성한다.
 *
 * 비용·정책:
 *  - 키(ANTHROPIC_API_KEY) 미설정 시 null 반환 → 호출측은 기존 휴리스틱 그래프로 폴백(지출 0).
 *  - 검색당 1회 호출(상위 출처만 전송, thinking 미사용)로 비용 통제. 결과는 리포트 캐시(7일, ADR-0011)로
 *    재사용 — 스냅샷(데이터)이 30분 만료된 뒤에도 비싼 LLM 호출은 건너뛴다.
 *  - PIPA: 개인은 공인·공개정보 한정, 민감정보 생성·추론 금지(프롬프트 가드).
 *  - 근거: ADR-0008, ADR-0011.
 */

/**
 * 활용 관점은 더 이상 고정 목록에서 고르지 않는다(ADR-0019). LLM이 주제·출처에 맞춰
 * 라벨을 직접 생성한다. 아래 예시는 프롬프트에 "예시일 뿐"으로 주입돼 다양성을 유도하며,
 * 산출 라벨을 제약하지 않는다(범용 9칸 enum 강제 → 주제 밀착 동적 생성).
 */
const ANGLE_EXAMPLES = [
  '핵심 사업·제품',
  '기술·R&D',
  '시장·경쟁 구도',
  '실적·재무',
  '산업·생태계',
  '규제·정책',
  '글로벌·지정학',
  '역사·배경',
  '사회·문화적 영향',
  '논란·리스크',
  '트렌드·전망',
  '투자',
  '취업·커리어',
  '소비자·사용 경험',
] as const;

/** 분석에 보낼 최대 출처 수(토큰·비용 통제). 다양한 관점 도출 재료 확보를 위해 상향(ADR-0019). */
const MAX_SOURCES = 24;
/** 출력 토큰 상한. 관점 수↑(최대 9개)에 따른 JSON 절단→파싱실패 폴백을 막기 위해 상향(ADR-0019). */
const MAX_TOKENS = 6000;
/** 서로 구별되는 관점 목표 상한(가독성 예산·MAX_BRANCHES와 정합). */
const MAX_ANGLES = 9;
/** 노드 라벨 최대 길이(3D 렌더 가독성). 초과분은 절단. */
const MAX_LABEL_LEN = 24;

/** 정제된 활용 관점 한 건(그래프 노드로 변환됨). */
export interface UsageAngle {
  /** 주제 밀착 관점 라벨(LLM 생성 → 정제됨). 노드 라벨이 된다. */
  label: string;
  /** 한 줄 핵심(노드 요약) */
  hook: string;
  /** 여러 문단 상세 리포트 */
  report: string;
  /** 근거 출처 id(GraphSnapshot.sources 참조) */
  sourceIds: string[];
}

export interface UsageReport {
  /** 출처에서 파악한 핵심 정보 요약(중심 노드 리포트) */
  summary: string;
  angles: UsageAngle[];
}

/**
 * Claude 구조화 출력 스키마(런타임 검증). 출력 텍스트(JSON)를 이 스키마로 파싱한다.
 *
 * 짝꿍 `ANALYSIS_JSON_SCHEMA`(아래)와 형태가 일치해야 한다 — 한쪽만 바꾸면 API가 강제하는 형태와
 * 파서가 기대하는 형태가 어긋나 조용히 폴백된다. `report.schema.test.ts`가 둘의 정합성을 잠근다.
 * (와이어 스키마는 손으로 써서 `additionalProperties:false` 같은 엄격 출력 제약을 명시적으로 둔다 —
 *  ADR-0019부터 관점 라벨은 동적 자유 문자열이라 enum 강제는 없고, 드리프트 잠금만 유지한다.)
 */
export const AnalysisSchema = z.object({
  summary: z.string(),
  angles: z.array(
    z.object({
      label: z.string(),
      hook: z.string(),
      report: z.string(),
      sourceRefs: z.array(z.number().int()),
    }),
  ),
});

/** 위 zod 스키마에 대응하는 JSON Schema(Claude output_config.format에 전달). 정합성은 report.schema.test.ts가 잠근다. */
export const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'angles'],
  properties: {
    summary: { type: 'string' },
    angles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'hook', 'report', 'sourceRefs'],
        properties: {
          label: { type: 'string' },
          hook: { type: 'string' },
          report: { type: 'string' },
          sourceRefs: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  '너는 공개정보 기반 분석가다. cerebro(흩어진 공개정보를 마인드맵으로 보여주는 서비스)의 "정보 활용 리포트"를 한국어로 작성한다.',
  '입력으로 검색 주체(기업/브랜드/제품/공인)와 수집된 공개 출처 목록(번호 매김)이 주어진다.',
  '',
  '작업:',
  '1) summary: 출처에서 파악되는 핵심 정보를 3~5문장으로 사실 중심으로 정리한다.',
  '2) angles: 이 주체를 여러 각도로 이해·활용하는 데 의미 있는 "관점"을 가능한 한 다양하게 도출한다. 관점은 고정 목록에서 고르는 것이 아니라, 이 주체와 출처에 맞춰 네가 직접 만든다.',
  `   - 서로 뚜렷이 구별되는 관점을 ${MAX_ANGLES}개까지 만든다(출처가 풍부하면 6~9개, 빈약하면 적게). 겹치거나 사실상 같은 관점은 하나로 합친다.`,
  '   - 여러 축을 폭넓게 아우른다. 예: ' +
    ANGLE_EXAMPLES.join(', ') +
    ' 등. (이는 예시일 뿐이며, 반드시 이 주체에 밀착된 관점을 새로 만든다.)',
  '   - label: 그 관점을 압축한 2~12자 한국어 명사구. 막연한 "사회"·"경제"보다 "AI 데이터센터"·"수출 규제 리스크"처럼 주체에 구체적으로 밀착시킨다.',
  '   - 각 report는 단문이 아니라 2~4문장 이상의 리포트처럼, 그 관점에서 이 정보를 어떻게 읽고 활용할지 구체적으로 서술한다(왜 그런지, 무엇에 쓸 수 있는지).',
  '   - 가독성: summary와 각 report가 3문장 이상이면 논리 단위로 2~3개 문단으로 나누고, 문단 사이는 빈 줄(개행 두 번)로 구분한다. 한 문단은 2~3문장. 마크다운 기호(#, *, - 등)는 쓰지 말 것.',
  '   - 관련 없는 관점은 절대 포함하지 마라(억지로 채우지 말 것). 각 report는 제공된 출처에 근거해야 하며, 불확실하면 "추정"으로 표시하고 과장·단정은 피한다.',
  '   - 투자·주가·투자가치를 다루는 관점이면 호재/악재 가능성을 논하되, report 끝에 "(투자 조언이 아님)"을 덧붙인다.',
  '   - hook: 그 관점의 한 줄 핵심(노드 요약).',
  '   - sourceRefs: 그 관점이 근거로 삼은 출처 번호 배열(근거가 없으면 빈 배열).',
  '',
  'PIPA(개인정보보호): 개인은 공인·공개정보에 한정한다. 비공개 개인의 신상 프로파일링 금지. 민감정보(주민번호·연락처·집주소·건강상태·금융·정치/종교/성적지향)는 생성하거나 추론하지 마라.',
].join('\n');

interface AnalyzeDeps {
  /** 테스트용 클라이언트 주입(미지정 시 실제 Anthropic 클라이언트 생성) */
  client?: Pick<Anthropic, 'messages'>;
  /**
   * 예산 서킷 브레이커 주입(ADR-0013). 있으면 호출 전 차단 검사 + 호출 후 사용량 기록.
   * 미지정 시 예산 통제 없음(기존 동작 — 키 게이트·캐시·폴백만).
   */
  budget?: BudgetTracker;
}

/**
 * 활용 관점 리포트를 생성한다. 키 미설정이면 null(폴백). API/파싱 오류는 throw(호출측이 로깅·폴백).
 */
export async function analyzeUsage(
  query: string,
  items: NormalizedItem[],
  deps: AnalyzeDeps = {},
): Promise<UsageReport | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (items.length === 0) return null;

  // ADR-0014 컴플라이언스 게이트: LLM 재가공·7일 리포트 캐시·인용(sourceIds)은 Layer B(상업 OK 소스)만.
  // 네이버·카카오(Layer A)는 표시·30분 캐시 전용 — Claude로 보내거나 파생 리포트를 장기 저장하지 않는다.
  // 이 한 줄이 LLM 입력(sourceLines)·인용·리포트 캐시를 모두 Layer B로 정합시킨다(단일 게이트).
  //
  // 예외 — 개인 전용 모드(ADR-0018): 운영자 본인만 쓰는 비공개·비영리 인스턴스에선 Layer A도 포함해
  // '처음처럼' 한국어/시의성 깊이를 복원한다. 기본 OFF(공개 안전). 게이트는 여전히 이 한 줄이라
  // 입력·인용·캐시가 함께 정합된다(개인 모드에선 A+B, 공개 모드에선 B만).
  const analyzable = env.PERSONAL_USE_MODE ? items : items.filter((it) => it.layer === 'B');
  if (analyzable.length === 0) return null; // 분석 가능한 소스가 없으면 휴리스틱 그래프로 폴백(지출 0).

  // 예산 소진(서킷 오픈) 시 호출하지 않고 폴백(지출 0) — '키 없음'과 동일한 null 폴백 경로.
  if (deps.budget && !deps.budget.canSpend()) return null;

  const top = [...analyzable]
    .sort((a, b) => b.source.confidence - a.source.confidence)
    .slice(0, MAX_SOURCES);

  const sourceLines = top
    .map((it, i) => `[${i}] (${it.source.type}) ${it.source.title} — ${it.source.snippet ?? ''}`)
    .join('\n');
  const userContent = `검색 주체: ${query}\n\n수집된 공개 출처:\n${sourceLines}`;

  const client = deps.client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model: env.ANALYSIS_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    output_config: { format: { type: 'json_schema', schema: ANALYSIS_JSON_SCHEMA } },
  });

  // API가 청구한 토큰은 응답 내용과 무관하게 기록한다 — refusal/빈응답 early-return보다 먼저.
  if (deps.budget && res.usage) deps.budget.record(res.usage);

  if (res.stop_reason === 'refusal') return null;

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!text.trim()) return null;

  const parsed = AnalysisSchema.parse(JSON.parse(text));

  // 출력측 재마스킹(ADR-0014 잔여위험): 입력 스니펫을 마스킹해도 LLM이 산출물에 PII를
  // 생성·추론할 수 있다. 프롬프트 가드(SYSTEM_PROMPT)에 더해, 표시·7일 캐시 적재 전에 한 번 더 거른다.
  // 라벨도 동적 생성(ADR-0019)이라 동일하게 재마스킹·정제(공백 정규화·길이 상한·중복 제거)한다.
  const seenLabels = new Set<string>();
  const angles: UsageAngle[] = parsed.angles
    .map((a) => ({
      label: redactSensitive(a.label).replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LEN),
      hook: redactSensitive(a.hook),
      report: redactSensitive(a.report),
      sourceIds: a.sourceRefs
        .map((i) => top[i]?.source.id)
        .filter((id): id is string => typeof id === 'string'),
    }))
    .filter((a) => {
      if (a.report.trim().length === 0 || a.label.length === 0) return false;
      if (seenLabels.has(a.label)) return false; // 동일 라벨 중복 노드 방지
      seenLabels.add(a.label);
      return true;
    });

  return { summary: redactSensitive(parsed.summary), angles };
}
