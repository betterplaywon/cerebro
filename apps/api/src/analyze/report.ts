import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../env.js';
import type { NormalizedItem } from '../collect/normalize.js';

/**
 * 활용 관점(usage angle) 분석 — 수집된 공개 출처를 Claude로 정제해
 * "핵심 정보 요약 + 관점별 활용 리포트"를 생성한다.
 *
 * 비용·정책:
 *  - 키(ANTHROPIC_API_KEY) 미설정 시 null 반환 → 호출측은 기존 휴리스틱 그래프로 폴백(지출 0).
 *  - 검색당 1회 호출(상위 출처만 전송, thinking 미사용)로 비용 통제. 결과는 상위 캐시(30분)로 재사용.
 *  - PIPA: 개인은 공인·공개정보 한정, 민감정보 생성·추론 금지(프롬프트 가드).
 *  - 근거: ADR-0008.
 */

/** 후보 활용 관점(주체에 해당되는 것만 선택). key=식별자, label=노드 라벨. */
export const USAGE_ANGLES = [
  { key: 'investment', label: '투자 관점' },
  { key: 'career', label: '취업·커리어' },
  { key: 'economy', label: '경제·산업' },
  { key: 'society', label: '사회' },
  { key: 'health', label: '건강' },
  { key: 'relationship', label: '관계·접점' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'books', label: '도서' },
  { key: 'content', label: '콘텐츠' },
] as const;

export type UsageAngleKey = (typeof USAGE_ANGLES)[number]['key'];
const ANGLE_LABELS = Object.fromEntries(USAGE_ANGLES.map((a) => [a.key, a.label])) as Record<
  UsageAngleKey,
  string
>;
const ANGLE_KEYS = USAGE_ANGLES.map((a) => a.key);

/** 분석에 보낼 최대 출처 수(토큰·비용 통제). */
const MAX_SOURCES = 18;
const MAX_TOKENS = 4000;

/** 정제된 활용 관점 한 건(그래프 노드로 변환됨). */
export interface UsageAngle {
  key: UsageAngleKey;
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

/** Claude 구조화 출력 스키마(런타임 검증). 출력 텍스트(JSON)를 이 스키마로 파싱한다. */
const AnalysisSchema = z.object({
  summary: z.string(),
  angles: z.array(
    z.object({
      key: z.enum(ANGLE_KEYS as [string, ...string[]]),
      hook: z.string(),
      report: z.string(),
      sourceRefs: z.array(z.number().int()),
    }),
  ),
});

/** 위 zod 스키마에 대응하는 JSON Schema(Claude output_config.format에 전달). */
const ANALYSIS_JSON_SCHEMA = {
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
        required: ['key', 'hook', 'report', 'sourceRefs'],
        properties: {
          key: { type: 'string', enum: ANGLE_KEYS },
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
  '2) angles: 아래 후보 관점 중 이 주체와 "실제로 관련 있는 것만" 골라, 각 관점에서 이 정보를 어떻게 활용할 수 있는지 구체적으로 서술한다.',
  '   - 각 report는 단문이 아니라 2~4문장 이상의 리포트처럼 작성한다(왜 그런지, 무엇에 쓸 수 있는지).',
  '   - 관련 없는 관점은 절대 포함하지 마라(억지로 채우지 말 것). 출처가 빈약하면 angles를 적게 반환한다.',
  '   - 각 report는 제공된 출처에 근거해야 한다. 불확실하면 "추정"으로 표시하고, 과장·단정은 피한다.',
  '   - 투자 관점은 호재/악재 가능성을 논하되, report 끝에 "(투자 조언이 아님)"을 덧붙인다.',
  '   - sourceRefs: 그 관점이 근거로 삼은 출처 번호 배열(근거가 없으면 빈 배열).',
  '',
  'PIPA(개인정보보호): 개인은 공인·공개정보에 한정한다. 비공개 개인의 신상 프로파일링 금지. 민감정보(주민번호·연락처·집주소·건강상태·금융·정치/종교/성적지향)는 생성하거나 추론하지 마라.',
  '',
  `후보 관점(key: 설명) — ${USAGE_ANGLES.map((a) => `${a.key}(${a.label})`).join(', ')}`,
].join('\n');

interface AnalyzeDeps {
  /** 테스트용 클라이언트 주입(미지정 시 실제 Anthropic 클라이언트 생성) */
  client?: Pick<Anthropic, 'messages'>;
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

  const top = [...items]
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

  if (res.stop_reason === 'refusal') return null;

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!text.trim()) return null;

  const parsed = AnalysisSchema.parse(JSON.parse(text));

  const angles: UsageAngle[] = parsed.angles
    .filter((a) => a.report.trim().length > 0)
    .map((a) => ({
      key: a.key as UsageAngleKey,
      label: ANGLE_LABELS[a.key as UsageAngleKey],
      hook: a.hook,
      report: a.report,
      sourceIds: a.sourceRefs
        .map((i) => top[i]?.source.id)
        .filter((id): id is string => typeof id === 'string'),
    }));

  return { summary: parsed.summary, angles };
}
