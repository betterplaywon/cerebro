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

describe('EnvSchema (ADR-0013 예산 서킷 브레이커 변수)', () => {
  it('미설정 시 안전 기본값(예산 8, 단가 $3/$15)을 적용한다', () => {
    const parsed = EnvSchema.parse({});
    expect(parsed.ANTHROPIC_BUDGET_USD).toBe(8);
    expect(parsed.ANALYSIS_INPUT_USD_PER_MTOK).toBe(3);
    expect(parsed.ANALYSIS_OUTPUT_USD_PER_MTOK).toBe(15);
  });

  it('문자열 값을 숫자로 강제하고, 예산 0(킬 스위치)을 허용한다', () => {
    const parsed = EnvSchema.parse({
      ANTHROPIC_BUDGET_USD: '5.5',
      ANALYSIS_INPUT_USD_PER_MTOK: '4',
      ANALYSIS_OUTPUT_USD_PER_MTOK: '20',
    });
    expect(parsed.ANTHROPIC_BUDGET_USD).toBe(5.5);
    expect(parsed.ANALYSIS_INPUT_USD_PER_MTOK).toBe(4);
    expect(parsed.ANALYSIS_OUTPUT_USD_PER_MTOK).toBe(20);
    expect(EnvSchema.parse({ ANTHROPIC_BUDGET_USD: '0' }).ANTHROPIC_BUDGET_USD).toBe(0);
  });

  it('예산은 음수를, 단가는 0/음수를 거부한다', () => {
    expect(() => EnvSchema.parse({ ANTHROPIC_BUDGET_USD: '-1' })).toThrow();
    expect(() => EnvSchema.parse({ ANALYSIS_INPUT_USD_PER_MTOK: '0' })).toThrow();
    expect(() => EnvSchema.parse({ ANALYSIS_OUTPUT_USD_PER_MTOK: '-3' })).toThrow();
  });
});
