import { describe, expect, it } from 'vitest';
import { EnvSchema } from './env.js';

/**
 * env 경계 검증 — ADR-0011 신규 변수의 기본값·강제(coerce)·boolean 파싱을 단위 검증한다.
 * 실제 process.env가 아니라 명시 입력으로 파싱해 ambient env에 의존하지 않는다.
 */
describe('EnvSchema (ADR-0011 신규 변수)', () => {
  it('빈 입력이면 REPORT_CACHE_TTL_MS=7일, PREWARM_ON_START=false 기본값을 적용한다', () => {
    const parsed = EnvSchema.parse({});
    expect(parsed.REPORT_CACHE_TTL_MS).toBe(1000 * 60 * 60 * 24 * 7); // 604800000
    expect(parsed.PREWARM_ON_START).toBe(false);
    // 기존 기본값도 유지(회귀 방지)
    expect(parsed.CACHE_TTL_MS).toBe(1000 * 60 * 30);
  });

  it('REPORT_CACHE_TTL_MS는 문자열을 숫자로 강제한다', () => {
    expect(EnvSchema.parse({ REPORT_CACHE_TTL_MS: '1000' }).REPORT_CACHE_TTL_MS).toBe(1000);
  });

  it('REPORT_CACHE_TTL_MS는 양수가 아니면 거부한다', () => {
    expect(() => EnvSchema.parse({ REPORT_CACHE_TTL_MS: '0' })).toThrow();
    expect(() => EnvSchema.parse({ REPORT_CACHE_TTL_MS: '-5' })).toThrow();
  });

  it.each(['true', '1', 'yes', 'on', 'TRUE'])(
    'PREWARM_ON_START=%s → true',
    (raw) => {
      expect(EnvSchema.parse({ PREWARM_ON_START: raw }).PREWARM_ON_START).toBe(true);
    },
  );

  it.each(['false', '0', '', 'nope'])('PREWARM_ON_START=%s → false', (raw) => {
    expect(EnvSchema.parse({ PREWARM_ON_START: raw }).PREWARM_ON_START).toBe(false);
  });
});
