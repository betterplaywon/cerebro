import { EXAMPLE_QUERIES } from '@cerebro/shared';
import type { PipelineLogger, SearchOrchestrator } from './search-orchestrator.js';

/**
 * 시드 프리웜(ADR-0011) — 콜드스타트 직후 대표 쿼리로 두 캐시(스냅샷 30분·리포트 7일)를 미리 채워
 * 첫 사용자의 지연(수집+LLM)을 줄인다.
 *
 * ⚠️ 비용 트레이드오프: 캐시가 인메모리 + Render 무료 티어는 유휴 시 spin-down 된다.
 * 따라서 콜드스타트마다 프리웜이 다시 돌아 그만큼 외부 수집·LLM 호출 비용이 재발생한다.
 * 그래서 기본 OFF(env.PREWARM_ON_START=false) — 영속 캐시(Supabase/Redis)나 항상 켜진 안정
 * 인스턴스에서만 ON 권장. 키가 없으면(env.ANTHROPIC_API_KEY 미설정) 리포트는 폴백되어 LLM 비용은 0.
 */

/**
 * 프리웜 시드 = 검색어 예시 SSOT(`@cerebro/shared` EXAMPLE_QUERIES) — 홈 추천칩과 동일 목록이라
 * 추천칩 클릭이 이 프리웜으로 데워진 캐시에 적중한다. 대상·PIPA·규모 정책은 SSOT 주석 참조
 * (대표 기업·브랜드 + 공인/공개정보 한정).
 */
export const PREWARM_SEEDS: readonly string[] = EXAMPLE_QUERIES;

/** 시드 사이 간격(ms) — 외부 소스 rate limit·LLM 비용 스파이크를 피해 저빈도로 순차 실행. */
const PREWARM_INTERVAL_MS = 1500;

export interface PrewarmOptions {
  /** 프리웜할 시드 목록(미지정 시 PREWARM_SEEDS). */
  seeds?: readonly string[];
  /** 시드 사이 대기(ms). */
  intervalMs?: number;
  /** 대기 구현 주입(테스트는 즉시 resolve로 시간 의존 제거). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 시드 쿼리를 순차·저빈도로 검색해 캐시를 채운다.
 * best-effort: 한 시드 실패는 로깅 후 흡수하고 나머지를 계속한다(기동 크래시 금지).
 */
export async function prewarm(
  orchestrator: SearchOrchestrator,
  logger: PipelineLogger,
  options: PrewarmOptions = {},
): Promise<void> {
  const seeds = options.seeds ?? PREWARM_SEEDS;
  const intervalMs = options.intervalMs ?? PREWARM_INTERVAL_MS;
  const sleep = options.sleep ?? defaultSleep;

  for (let i = 0; i < seeds.length; i += 1) {
    const query = seeds[i];
    if (!query) continue;
    try {
      await orchestrator.search(query, undefined, new Date().toISOString(), logger);
    } catch (err) {
      // 한 시드 실패가 나머지 프리웜을 막지 않게 흡수(best-effort).
      logger.warn({ err, query }, '프리웜 시드 실패 — 건너뜀');
    }
    if (i < seeds.length - 1) await sleep(intervalMs);
  }
}
