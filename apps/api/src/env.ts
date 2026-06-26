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

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** 검색 결과 캐시 TTL(ms). 무료 운영 핵심 — 기본 30분 */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 30),
  // 키 필요 소스(미설정 시 해당 어댑터 자동 비활성). 값은 .env에서만 주입.
  NAVER_CLIENT_ID: optionalSecret,
  NAVER_CLIENT_SECRET: optionalSecret,
  // Brave Search(Web Search API) — 구글 Custom Search JSON API 종료(신규 고객 차단) 대체. (ADR-0005)
  BRAVE_SEARCH_API_KEY: optionalSecret,
});

export const env = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;
