import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

/** 소스별 호출 레이트 제한. 무료 쿼터/차단 방지의 1차 수단. */
export interface RateLimiter {
  acquire(): Promise<void>;
}

/**
 * 토큰 버킷 레이트 리미터. 지속 호출률은 평균 1토큰/minIntervalMs로 캡하되(무료 쿼터·차단 방지),
 * `burst`까지는 즉시 통과시켜 **한 검색의 동시 엔드포인트**(naver 5·kakao 3)가 직렬로 줄서지 않게 한다.
 *
 * 동기: 멀티엔드포인트 어댑터가 엔드포인트마다 acquire를 await하면, 단순 최소간격 직렬화는
 * 동일 검색의 5개 호출을 0/120/…/480ms로 스태거해 캐시-미스 검색마다 ~480ms 순지연을 더했다
 * (한 검색 내 동시 호출은 일일 쿼터에 무익하므로 순수 낭비). 토큰 버킷은 이 인트라-검색 스태거만
 * 없애고 **지속 상한(1/minIntervalMs)은 그대로 유지**해 아웃바운드 폭주를 막는다. 트레이드오프=ADR-0017.
 *
 * @param minIntervalMs 토큰 1개 리필 간격(평균 호출 간격 상한)
 * @param burst 즉시 통과 가능한 최대 동시 호출 수(버킷 용량). 기본 1 = 종전 순차 직렬화와 동일.
 */
export function createRateLimiter(minIntervalMs: number, burst = 1): RateLimiter {
  const capacity = Math.max(1, burst);
  let tokens = capacity; // 가용 토큰(부동소수: 부분 리필 허용)
  // 경과시간은 단조 시계(performance.now)로 잰다 — 벽시계(Date.now)는 NTP step/수동 변경으로
  // 역행하면 토큰이 음수가 돼 과대 대기(자기-DoS)를 유발한다(보안 리뷰 권고, ADR-0017).
  let last = performance.now(); // 마지막 리필 기준 시각
  // 토큰 회계는 단일 체인으로 직렬화해 동시 acquire 간 경합(리필·차감 분실)을 막는다.
  let chain: Promise<void> = Promise.resolve();

  return {
    acquire() {
      chain = chain.then(async () => {
        const now = performance.now();
        tokens = Math.min(capacity, tokens + (now - last) / minIntervalMs);
        last = now;
        if (tokens >= 1) {
          tokens -= 1; // 토큰 여유 → 대기 없이 통과(버스트)
          return;
        }
        // 토큰 부족 → 1토큰이 찰 때까지만 대기 후 소비(지속 상한 유지).
        await delay((1 - tokens) * minIntervalMs);
        tokens = 0;
        last = performance.now();
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
