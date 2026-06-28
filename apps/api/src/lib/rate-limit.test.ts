import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter, withRetry } from './rate-limit.js';

describe('withRetry', () => {
  it('실패 후 재시도하여 성공한다', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('일시 오류');
      return 'ok';
    });
    const result = await withRetry(fn, { retries: 3, baseMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('재시도 소진 후 마지막 에러를 던진다', async () => {
    const fn = vi.fn(async () => {
      throw new Error('영구 오류');
    });
    await expect(withRetry(fn, { retries: 2, baseMs: 1 })).rejects.toThrow('영구 오류');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('shouldRetry=false 이면 즉시 중단한다', async () => {
    const fn = vi.fn(async () => {
      throw new Error('치명');
    });
    await expect(withRetry(fn, { retries: 5, baseMs: 1, shouldRetry: () => false })).rejects.toThrow('치명');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('createRateLimiter', () => {
  it('최소 간격만큼 호출을 띄운다(기본 burst=1)', async () => {
    const limiter = createRateLimiter(30);
    const start = Date.now();
    await limiter.acquire(); // 즉시
    await limiter.acquire(); // ~30ms 대기
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
  });

  it('burst 한도 안의 동시 호출은 스태거 없이 즉시 통과한다(인트라-검색 동시 발사)', async () => {
    const limiter = createRateLimiter(120, 5);
    const start = Date.now();
    // 한 검색의 5개 엔드포인트를 동시에 발사 → 직렬 스태거(0/120/…/480ms) 없이 모두 즉시.
    await Promise.all(Array.from({ length: 5 }, () => limiter.acquire()));
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('burst 소진 후에는 지속 상한(1토큰/간격)으로 throttle한다', async () => {
    const limiter = createRateLimiter(30, 2);
    const start = Date.now();
    await limiter.acquire(); // 토큰 2→1, 즉시
    await limiter.acquire(); // 토큰 1→0, 즉시
    expect(Date.now() - start).toBeLessThan(20); // 버스트 구간
    await limiter.acquire(); // 토큰 부족 → ~30ms 대기(지속 상한 유지)
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
  });
});
