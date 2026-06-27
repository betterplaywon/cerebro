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
  /** 검색 결과(스냅샷=데이터+리포트) 캐시 TTL(ms). 신선도·쿼터·핫패스 — 기본 30분 */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 30),
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
  // 키 필요 소스(미설정 시 해당 어댑터 자동 비활성). 값은 .env에서만 주입.
  NAVER_CLIENT_ID: optionalSecret,
  NAVER_CLIENT_SECRET: optionalSecret,
  // 카카오(다음) 검색 API — 국내 커뮤니티 커버리지 보완(미설정 시 kakao 어댑터 비활성).
  KAKAO_REST_API_KEY: optionalSecret,
  // Claude 분석 리포트(활용 관점). 미설정 시 LLM 분석 비활성 → 기존 휴리스틱 그래프로 폴백(지출 0).
  ANTHROPIC_API_KEY: optionalSecret,
  /** 분석에 쓸 Claude 모델. 비용·품질 균형으로 Sonnet 4.6 기본(ADR-0008). */
  ANALYSIS_MODEL: z.string().min(1).default('claude-sonnet-4-6'),
});

export const env = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;
