import type { GraphSnapshot, SubjectType } from '@cerebro/shared';
import type { TTLCache } from '../lib/cache.js';
import type { SourceAdapter } from '../sources/types.js';
import { collectAll } from '../collect/orchestrator.js';
import { buildGraphFromCollection } from '../graph/build.js';
import { buildMockGraph } from '../graph/mock.js';
import { analyzeUsage, type UsageReport } from '../analyze/report.js';

/**
 * Search Orchestrator (ARCHITECTURE §2.2) — Routes 와 Collectors 사이의 application 레이어.
 * 책임: 캐시 조회(L2 인메모리) → miss 시 수집·정제·빌드 코디네이트 → write-back.
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

/** 의미 있는 그래프의 최소 노드 수 = 중심(1) + 가지 1개 이상. 이하면 빈약 → 목업 폴백. */
const MIN_MEANINGFUL_GRAPH_NODES = 2;

/**
 * 수집→분석→그래프빌드→폴백 파이프라인(캐시 제외, 순수 코디네이션).
 * 한 어댑터 실패는 부분 결과로 흡수(collectAll), LLM 분석 실패는 휴리스틱 그래프로 폴백,
 * 수집 자체 실패는 목업 그래프로 폴백해 검색 루프가 끊기지 않게 한다.
 */
export async function buildSearchGraph(
  query: string,
  type: SubjectType | undefined,
  now: string,
  adapters?: SourceAdapter[],
  logger?: PipelineLogger,
): Promise<GraphSnapshot> {
  try {
    const { items } = await collectAll(query, type, now, adapters);

    // LLM 활용 관점 분석(키 있으면). 실패해도 휴리스틱 그래프로 진행(검색이 끊기지 않게).
    let analysis: UsageReport | null = null;
    try {
      analysis = await analyzeUsage(query, items);
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

export interface SearchOrchestratorDeps {
  /** L2 인메모리 캐시(인스턴스 스코프 — 테스트 격리). */
  cache: TTLCache<GraphSnapshot>;
  /** 수집 어댑터 주입(미지정 시 registry 사용). 테스트는 fixture 주입으로 무네트워크. */
  adapters?: SourceAdapter[];
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
  const { cache, adapters } = deps;

  return {
    async search(query, type, now, logger) {
      const cacheKey = `${query}::${type ?? ''}`;

      const cachedGraph = cache.get(cacheKey);
      if (cachedGraph) return { graph: cachedGraph, cached: true };

      const graph = await buildSearchGraph(query, type, now, adapters, logger);
      cache.set(cacheKey, graph);
      return { graph, cached: false };
    },
  };
}
