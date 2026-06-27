import { describe, expect, it } from 'vitest';
import { createBudgetTracker } from './budget.js';

/** Sonnet 4.6 기본 단가(ADR-0008/0013). */
const SONNET = { inputUsdPerMTok: 3, outputUsdPerMTok: 15 } as const;

describe('createBudgetTracker — 비용 계산', () => {
  it('입력/출력 토큰을 단가로 정확히 추정한다(input 3000 + output 2500 → $0.0465)', () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    budget.record({ input_tokens: 3000, output_tokens: 2500 });
    expect(budget.getStats().spentUsd).toBeCloseTo(0.0465, 6);
  });

  it('여러 번 record하면 누적된다', () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    budget.record({ input_tokens: 3000, output_tokens: 2500 });
    budget.record({ input_tokens: 3000, output_tokens: 2500 });
    const stats = budget.getStats();
    expect(stats.tokens.input).toBe(6000);
    expect(stats.tokens.output).toBe(5000);
    expect(stats.spentUsd).toBeCloseTo(0.093, 6);
  });

  it('캐시 생성/읽기 토큰도 합산한다(기본 비율: 쓰기 1.25× · 읽기 0.1× 입력단가)', () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    // cache write 1M → 3.75, cache read 1M → 0.30
    budget.record({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    const stats = budget.getStats();
    expect(stats.tokens.cacheCreation).toBe(1_000_000);
    expect(stats.tokens.cacheRead).toBe(1_000_000);
    expect(stats.spentUsd).toBeCloseTo(4.05, 6);
  });

  it('음수/NaN/null 토큰은 0으로 방어 정규화한다(잘못된 청구치 무시)', () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    budget.record({
      input_tokens: -100,
      output_tokens: Number.NaN,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: undefined,
    });
    const stats = budget.getStats();
    expect(stats.spentUsd).toBe(0);
    expect(stats.tokens).toEqual({ input: 0, output: 0, cacheCreation: 0, cacheRead: 0 });
  });
});

describe('createBudgetTracker — 경계값(canSpend)', () => {
  it('상한 미만이면 허용, 도달하면 차단(경계 정확)', () => {
    // cap=3 → 입력 1M 토큰 = $3.0 가 정확히 상한.
    const budget = createBudgetTracker({ capUsd: 3, ...SONNET });
    expect(budget.canSpend()).toBe(true); // 0 < 3

    budget.record({ input_tokens: 999_999, output_tokens: 0 }); // $2.999997
    expect(budget.canSpend()).toBe(true); // cap 직전 = 허용

    budget.record({ input_tokens: 1, output_tokens: 0 }); // 합계 1M = $3.0
    expect(budget.canSpend()).toBe(false); // cap 도달 = 차단
  });

  it('상한 초과 후에도 계속 차단된다', () => {
    const budget = createBudgetTracker({ capUsd: 3, ...SONNET });
    budget.record({ input_tokens: 2_000_000, output_tokens: 0 }); // $6.0 > $3
    expect(budget.canSpend()).toBe(false);
    expect(budget.getStats().open).toBe(true);
    expect(budget.getStats().remainingUsd).toBe(0); // 음수 클램프
  });

  it('cap=0이면 처음부터 항상 차단(킬 스위치)', () => {
    const budget = createBudgetTracker({ capUsd: 0, ...SONNET });
    expect(budget.canSpend()).toBe(false);
    expect(budget.getStats().open).toBe(true);
  });
});

describe('createBudgetTracker — 월(달력) 경계 리셋', () => {
  it('월 경계를 넘으면 누적이 0으로 리셋되어 서킷이 닫힌다(시계 주입)', () => {
    let t = Date.UTC(2026, 0, 15); // 2026-01-15
    const budget = createBudgetTracker({ capUsd: 3, ...SONNET, now: () => t });

    budget.record({ input_tokens: 1_000_000, output_tokens: 0 }); // $3.0 → 상한 도달
    expect(budget.canSpend()).toBe(false);
    expect(budget.getStats().windowStart).toBe('2026-01-01T00:00:00.000Z');

    t = Date.UTC(2026, 1, 1); // 2026-02-01 → 새 달
    expect(budget.canSpend()).toBe(true); // 리셋 → 서킷 닫힘
    const stats = budget.getStats();
    expect(stats.spentUsd).toBe(0);
    expect(stats.tokens.input).toBe(0);
    expect(stats.windowStart).toBe('2026-02-01T00:00:00.000Z');
  });

  it('같은 달 안에서는 누적이 유지된다(리셋 없음)', () => {
    let t = Date.UTC(2026, 5, 1);
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET, now: () => t });
    budget.record({ input_tokens: 3000, output_tokens: 2500 });
    t = Date.UTC(2026, 5, 28); // 같은 6월
    expect(budget.getStats().spentUsd).toBeCloseTo(0.0465, 6);
  });

  it('연도 경계(12월→1월)도 새 윈도우로 리셋한다', () => {
    let t = Date.UTC(2026, 11, 31); // 2026-12-31
    const budget = createBudgetTracker({ capUsd: 3, ...SONNET, now: () => t });
    budget.record({ input_tokens: 1_000_000, output_tokens: 0 });
    expect(budget.canSpend()).toBe(false);
    t = Date.UTC(2027, 0, 1); // 2027-01-01
    expect(budget.canSpend()).toBe(true);
    expect(budget.getStats().windowStart).toBe('2027-01-01T00:00:00.000Z');
  });
});
