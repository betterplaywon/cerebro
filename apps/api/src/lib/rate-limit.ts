import { setTimeout as delay } from 'node:timers/promises';

/** 소스별 최소 호출 간격 보장(순차 직렬화). 무료 쿼터/차단 방지의 1차 수단. */
export interface RateLimiter {
  acquire(): Promise<void>;
}

export function createRateLimiter(minIntervalMs: number): RateLimiter {
  let last = 0;
  let chain: Promise<void> = Promise.resolve();

  return {
    acquire() {
      chain = chain.then(async () => {
        const now = Date.now();
        const wait = last + minIntervalMs - now;
        if (wait > 0) await delay(wait);
        last = Date.now();
      });
      return chain;
    },
  };
}

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/** 지수 백오프 재시도. 일시적 네트워크/5xx에만 재시도하도록 shouldRetry로 제어. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 200;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const more = attempt < retries;
      const allowed = opts.shouldRetry ? opts.shouldRetry(error) : true;
      if (!more || !allowed) break;
      await delay(baseMs * 2 ** attempt);
    }
  }
  throw lastError;
}
