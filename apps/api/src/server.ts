import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  SearchRequestSchema,
  SearchResponseSchema,
  type ApiError,
  type GraphSnapshot,
} from '@cerebro/shared';
import { env } from './env.js';
import { createTTLCache } from './lib/cache.js';
import { createSearchOrchestrator } from './search/search-orchestrator.js';
import type { SourceAdapter } from './sources/types.js';

export interface BuildServerOptions {
  /** 수집 어댑터 주입(테스트는 fixture 주입으로 무네트워크). 미지정 시 registry 사용. */
  adapters?: SourceAdapter[];
}

/**
 * Fastify 앱 구성. 테스트(app.inject)와 실행(index.ts) 양쪽에서 재사용.
 * 라우트는 transport(검증·응답)만 담당하고, 검색 비즈니스 로직은 Search Orchestrator에 위임한다
 * (ARCHITECTURE §2.2). 캐시·오케스트레이터는 인스턴스별로 둬 테스트 격리를 보장한다.
 */
export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  const cache = createTTLCache<GraphSnapshot>({ ttlMs: env.CACHE_TTL_MS });
  const orchestrator = createSearchOrchestrator({ cache, adapters: opts.adapters });

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
    const result = await orchestrator.search(query, type, new Date().toISOString(), request.log);

    // 응답도 계약으로 검증해 SSOT 위반을 조기 차단.
    return reply.send(SearchResponseSchema.parse(result));
  });

  return app;
}
