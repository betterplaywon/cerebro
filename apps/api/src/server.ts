import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  SearchRequestSchema,
  SearchResponseSchema,
  type ApiError,
  type GraphSnapshot,
} from '@cerebro/shared';
import { env } from './env.js';
import { buildMockGraph } from './graph/mock.js';
import { createTTLCache } from './lib/cache.js';
import { collectAll } from './collect/orchestrator.js';
import { buildGraphFromCollection } from './graph/build.js';
import { analyzeUsage, type UsageReport } from './analyze/report.js';
import type { SourceAdapter } from './sources/types.js';

export interface BuildServerOptions {
  /** 수집 어댑터 주입(테스트는 fixture 주입으로 무네트워크). 미지정 시 registry 사용. */
  adapters?: SourceAdapter[];
}

/**
 * Fastify 앱 구성. 테스트(app.inject)와 실행(index.ts) 양쪽에서 재사용.
 * 캐시는 인스턴스별로 둬 테스트 격리를 보장한다.
 */
export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  const cache = createTTLCache<GraphSnapshot>({ ttlMs: env.CACHE_TTL_MS });

  app.register(cors, { origin: env.CORS_ORIGIN });

  app.get('/health', async () => ({ status: 'ok' as const }));

  app.post('/api/search', async (request, reply) => {
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const body: ApiError = {
        error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? '잘못된 요청' },
      };
      return reply.code(400).send(body);
    }

    const { query, type } = parsed.data;
    const cacheKey = `${query}::${type ?? ''}`;

    const cachedGraph = cache.get(cacheKey);
    if (cachedGraph) {
      return reply.send(SearchResponseSchema.parse({ graph: cachedGraph, cached: true }));
    }

    const now = new Date().toISOString();
    let graph: GraphSnapshot;
    try {
      const { items } = await collectAll(query, type, now, opts.adapters);
      // LLM 활용 관점 분석(키 있으면). 실패해도 휴리스틱 그래프로 진행(검색이 끊기지 않게).
      let analysis: UsageReport | null = null;
      try {
        analysis = await analyzeUsage(query, items);
      } catch (err) {
        request.log.warn({ err }, 'LLM 활용 분석 실패 — 휴리스틱 그래프로 폴백');
      }
      graph = buildGraphFromCollection(query, type, items, now, analysis);
      // 수집 결과가 빈약하면 목업으로 폴백(데모 연속성)
      if (graph.nodes.length <= 1) graph = buildMockGraph(query, type);
    } catch (err) {
      request.log.error({ err }, '수집 실패 — 목업으로 폴백');
      graph = buildMockGraph(query, type);
    }

    cache.set(cacheKey, graph);
    // 응답도 계약으로 검증해 SSOT 위반을 조기 차단.
    return reply.send(SearchResponseSchema.parse({ graph, cached: false }));
  });

  return app;
}
