import 'dotenv/config';
import { z } from 'zod';

/**
 * 환경변수 검증 (경계에서 zod). 누락/오타를 부팅 시 즉시 실패로 드러낸다.
 * 시크릿은 여기서 "존재 여부"만 다루고 값은 절대 로깅하지 않는다.
 */
/** 빈 문자열('')은 미설정(undefined)으로 취급 — .env에 빈 키가 있어도 안전 */
const optionalSecret = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
);

/** env의 boolean 플래그. 문자열만 들어오므로 truthy 토큰만 true, 그 외(빈값/미설정 포함)는 false. */
const booleanFlag = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
  return false;
}, z.boolean());

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * 검색 결과(스냅샷=데이터+리포트) 캐시 TTL(ms). 신선도·쿼터·핫패스 — 기본 30분.
   * 상한 30분은 ADR-0014 컴플라이언스: 스냅샷은 Layer A(네이버·카카오) 표시 노드를 포함하는
   * 유일한 요청-초과 저장소이며, Layer A는 '≤30분 단순 캐시만' 허용된다. 초과 설정은 부팅 시 거부.
   */
  CACHE_TTL_MS: z.coerce.number().int().positive().max(1000 * 60 * 30).default(1000 * 60 * 30),
  /**
   * LLM 활용 리포트 캐시 TTL(ms). 스냅샷과 분리된 2단 캐시(ADR-0011) — 기본 7일.
   * 데이터는 매번 신선하게 재수집하되, 비싼 LLM 리포트는 길게 재사용해 호출을 30분→7일당 1회로 격감.
   */
  REPORT_CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 24 * 7),
  /**
   * 기동 시 시드 쿼리 프리웜 실행 여부(ADR-0011). 기본 OFF.
   * ⚠️ 인메모리 캐시 + Render 무료 spin-down → 콜드스타트마다 프리웜 재실행 = 재호출 비용.
   * 영속 캐시/안정 인스턴스에서만 ON 권장.
   */
  PREWARM_ON_START: booleanFlag.default(false),
  /**
   * 개인 전용 모드(ADR-0018). 기본 OFF — 공개/다중사용자/수익화 인스턴스의 안전 기본값.
   * ON이면 Layer A(네이버·카카오) 검색결과도 LLM 활용 리포트 입력·인용·캐시에 포함한다
   * (LAYER-SPLIT 게이트 완화, '처음처럼' 한국어/시의성 깊이 복원).
   * ⚠️ 운영자 본인만 쓰는 **비공개·비영리** 인스턴스에서만 ON 할 것 — 네이버·카카오 오픈API 약관은
   *    검색결과의 재가공·장기저장을 금지한다(ADR-0014). 공개 배포·타인 제공·수익화 시 반드시 OFF.
   */
  PERSONAL_USE_MODE: booleanFlag.default(false),
  // 키 필요 소스(미설정 시 해당 어댑터 자동 비활성). 값은 .env에서만 주입.
  NAVER_CLIENT_ID: optionalSecret,
  NAVER_CLIENT_SECRET: optionalSecret,
  // 카카오(다음) 검색 API — 국내 커뮤니티 커버리지 보완(미설정 시 kakao 어댑터 비활성).
  KAKAO_REST_API_KEY: optionalSecret,
  // 공공데이터포털(data.go.kr) 서비스 키 — Layer B 한국어 기업 사실데이터(ADR-0015).
  // 미설정 시 publicdata 어댑터 자동 비활성. ⚠️ 이중 인코딩 함정: 포털의 'Decoding' 키를 넣을 것
  // (어댑터가 encodeURIComponent로 한 번만 인코딩한다 — Encoding 키를 넣으면 %가 이중 인코딩됨).
  DATA_GO_KR_SERVICE_KEY: optionalSecret,
  // Claude 분석 리포트(활용 관점). 미설정 시 LLM 분석 비활성 → 기존 휴리스틱 그래프로 폴백(지출 0).
  ANTHROPIC_API_KEY: optionalSecret,
  /** 분석에 쓸 Claude 모델. 비용·품질 균형으로 Sonnet 4.6 기본(ADR-0008). */
  ANALYSIS_MODEL: z.string().min(1).default('claude-sonnet-4-6'),
  /**
   * LLM 월 예산 상한(USD, 서킷 브레이커 — ADR-0013). 누적 추정 비용이 이 값에 도달하면
   * 분석을 자동 차단하고 휴리스틱 그래프로 폴백(지출 0). 기본 8($8.8 한도 미만 헤드룸).
   * 0이면 LLM 분석을 항상 차단(킬 스위치).
   */
  ANTHROPIC_BUDGET_USD: z.coerce.number().nonnegative().default(8),
  /** 분석 입력 토큰 단가(USD per 1M). 기본 Sonnet 4.6 = $3(ADR-0008). 모델 교체 시 동기화. */
  ANALYSIS_INPUT_USD_PER_MTOK: z.coerce.number().positive().default(3),
  /** 분석 출력 토큰 단가(USD per 1M). 기본 Sonnet 4.6 = $15(ADR-0008). 모델 교체 시 동기화. */
  ANALYSIS_OUTPUT_USD_PER_MTOK: z.coerce.number().positive().default(15),
});

export const env = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;
