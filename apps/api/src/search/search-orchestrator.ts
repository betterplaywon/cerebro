import type { GraphSnapshot, SubjectType } from '@cerebro/shared';
import type { TTLCache } from '../lib/cache.js';
import type { SourceAdapter } from '../sources/types.js';
import type { NormalizedItem } from '../collect/normalize.js';
import { collectAll } from '../collect/orchestrator.js';
import { buildGraphFromCollection } from '../graph/build.js';
import { buildMockGraph } from '../graph/mock.js';
import { analyzeUsage, type UsageReport } from '../analyze/report.js';

/**
 * Search Orchestrator (ARCHITECTURE §2.2) — Routes 와 Collectors 사이의 application 레이어.
 * 책임: 캐시 조회(2단: 스냅샷 30분 + 리포트 7일) → miss 시 수집·정제·빌드 코디네이트 → write-back.
 * 라우트(transport)에서 비즈니스 로직을 분리해 HTTP 없이 단위 테스트 가능하게 한다.
 */

/** 파이프라인이 쓰는 최소 로거(프레임워크 비결합). Fastify request.log 가 구조적으로 만족한다. */
export interface PipelineLogger {
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

export interface SearchResult {
  graph: GraphSnapshot;
  cached: boolean;
}

/** 수집 항목 → 활용 리포트(LLM) 해석기. 캐시·LLM 조율을 주입하기 위한 함수 경계. */
export type ReportResolver = (
  query: string,
  items: NormalizedItem[],
) => Promise<UsageReport | null>;

/** 의미 있는 그래프의 최소 노드 수 = 중심(1) + 가지 1개 이상. 이하면 빈약 → 목업 폴백. */
const MIN_MEANINGFUL_GRAPH_NODES = 2;

export interface BuildSearchGraphOptions {
  /** 수집 어댑터 주입(미지정 시 registry 사용). 테스트는 fixture 주입으로 무네트워크. */
  adapters?: SourceAdapter[];
  logger?: PipelineLogger;
  /**
   * 리포트 해석 주입(캐시+LLM 조율). 미지정 시 analyzeUsage 직접 호출(캐시 없음).
   * 오케스트레이터는 리포트 캐시 read-through 버전을 주입해 LLM 호출을 격감시킨다(ADR-0011).
   */
  resolveReport?: ReportResolver;
}

/**
 * 수집→분석→그래프빌드→폴백 파이프라인(스냅샷 캐시 제외, 순수 코디네이션).
 * 한 어댑터 실패는 부분 결과로 흡수(collectAll), LLM 분석 실패는 휴리스틱 그래프로 폴백,
 * 수집 자체 실패는 목업 그래프로 폴백해 검색 루프가 끊기지 않게 한다.
 */
export async function buildSearchGraph(
  query: string,
  type: SubjectType | undefined,
  now: string,
  options: BuildSearchGraphOptions = {},
): Promise<GraphSnapshot> {
  const { adapters, logger, resolveReport } = options;
  try {
    const { items } = await collectAll(query, type, now, adapters);

    // LLM 활용 관점 분석(키 있으면). 실패해도 휴리스틱 그래프로 진행(검색이 끊기지 않게).
    let analysis: UsageReport | null = null;
    try {
      analysis = resolveReport ? await resolveReport(query, items) : await analyzeUsage(query, items);
    } catch (err) {
      logger?.warn({ err }, 'LLM 활용 분석 실패 — 휴리스틱 그래프로 폴백');
    }

    const graph = buildGraphFromCollection(query, type, items, now, analysis);
    // 수집 결과가 빈약하면(중심 노드만) 목업으로 폴백(데모 연속성)
    return graph.nodes.length < MIN_MEANINGFUL_GRAPH_NODES ? buildMockGraph(query, type) : graph;
  } catch (err) {
    logger?.error({ err }, '수집 실패 — 목업으로 폴백');
    return buildMockGraph(query, type);
  }
}

/** query+type → 캐시 키(스냅샷·리포트 두 캐시가 동일 규칙을 공유). */
export function searchCacheKey(query: string, type: SubjectType | undefined): string {
  return `${query}::${type ?? ''}`;
}

/**
 * 리포트 2단 캐시의 read-through 핵심: 리포트 캐시(7일) 적중 시 LLM 호출을 건너뛰고,
 * 미스일 때만 analyzer(LLM)를 호출해 non-null 결과만 캐시에 적재한다.
 * 스냅샷(데이터) 캐시와 분리돼, 스냅샷이 30분 만료된 뒤에도 리포트는 최대 7일 재사용된다(비용 방어, ADR-0011).
 */
async function readThroughReportCache(
  reportCache: TTLCache<UsageReport>,
  key: string,
  query: string,
  items: NormalizedItem[],
  analyze: ReportResolver,
): Promise<UsageReport | null> {
  const cached = reportCache.get(key);
  if (cached) return cached;
  const report = await analyze(query, items);
  if (report) reportCache.set(key, report);
  return report;
}

export interface SearchOrchestratorDeps {
  /** 스냅샷(데이터+리포트) 캐시 — 30분. 인스턴스 스코프(테스트 격리). */
  cache: TTLCache<GraphSnapshot>;
  /** LLM 활용 리포트 캐시 — 7일. 스냅샷과 분리(ADR-0011). 인스턴스 스코프(테스트 격리). */
  reportCache: TTLCache<UsageReport>;
  /** 수집 어댑터 주입(미지정 시 registry 사용). 테스트는 fixture 주입으로 무네트워크. */
  adapters?: SourceAdapter[];
  /**
   * 리포트 분석기 주입(미지정 시 analyzeUsage). 테스트는 analyzeUsage의 client 모킹을 보존하기 위해
   * `(q, items) => analyzeUsage(q, items, { client })` 형태로 주입한다.
   */
  analyze?: ReportResolver;
}

export interface SearchOrchestrator {
  /** 캐시 read-through → miss 시 빌드 → write-back. cached 플래그로 적중 여부 노출. */
  search(
    query: string,
    type: SubjectType | undefined,
    now: string,
    logger?: PipelineLogger,
  ): Promise<SearchResult>;
}

export function createSearchOrchestrator(deps: SearchOrchestratorDeps): SearchOrchestrator {
  const { cache, reportCache, adapters } = deps;
  const analyze: ReportResolver = deps.analyze ?? ((query, items) => analyzeUsage(query, items));

  return {
    async search(query, type, now, logger) {
      const key = searchCacheKey(query, type);

      // 1) 스냅샷(30분) 적중 → 그대로 반환(데이터·리포트 모두 재사용, 핫패스).
      const cachedGraph = cache.get(key);
      if (cachedGraph) return { graph: cachedGraph, cached: true };

      // 2) 미스 → 데이터는 항상 새로 수집(신선). 리포트만 7일 캐시 read-through로 재사용.
      const graph = await buildSearchGraph(query, type, now, {
        adapters,
        logger,
        resolveReport: (q, items) => readThroughReportCache(reportCache, key, q, items, analyze),
      });

      // 3) 수집 데이터 + (캐시/신규) 리포트로 빌드한 스냅샷을 30분 캐시에 기록.
      cache.set(key, graph);
      return { graph, cached: false };
    },
  };
}
