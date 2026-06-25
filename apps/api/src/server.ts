import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { SearchRequestSchema, SearchResponseSchema, type ApiError } from '@cerebro/shared';
import { env } from './env.js';
import { buildMockGraph } from './graph/mock.js';

/**
 * Fastify 앱 구성. 테스트(app.inject)와 실행(index.ts) 양쪽에서 재사용.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  });

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

    // MVP: 목업 그래프. 추후 수집 파이프라인(SourceAdapter)으로 대체.
    const graph = buildMockGraph(parsed.data.query, parsed.data.type);
    // 응답도 계약으로 검증해 SSOT 위반을 조기 차단.
    const response = SearchResponseSchema.parse({ graph, cached: false });
    return reply.send(response);
  });

  return app;
}
