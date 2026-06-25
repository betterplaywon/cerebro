import 'dotenv/config';
import { z } from 'zod';

/**
 * 환경변수 검증 (경계에서 zod). 누락/오타를 부팅 시 즉시 실패로 드러낸다.
 * 시크릿은 여기서 "존재 여부"만 다루고 값은 절대 로깅하지 않는다.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;
