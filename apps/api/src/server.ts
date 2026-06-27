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
import { createSearchOrchestrator, type SearchOrchestrator } from './search/search-orchestrator.js';
import { analyzeUsage, type UsageReport } from './analyze/report.js';
import { createBudgetTracker, type BudgetTracker } from './analyze/budget.js';
import type { SourceAdapter } from './sources/types.js';

// 부팅 작업(프리웜 등)이 캐시 워밍에 재사용할 수 있도록 오케스트레이터를 인스턴스에 노출.
declare module 'fastify' {
  interface FastifyInstance {
    orchestrator: SearchOrchestrator;
  }
}

export interface BuildServerOptions {
  /** 수집 어댑터 주입(테스트는 fixture 주입으로 무네트워크). 미지정 시 registry 사용. */
  adapters?: SourceAdapter[];
  /**
   * LLM 예산 서킷 브레이커 주입(테스트는 예산 소진 상태를 주입해 폴백 검증). 미지정 시 env 기반 생성.
   * 인스턴스 스코프(캐시·오케스트레이터와 동일) — 테스트 격리 보장.
   */
  budget?: BudgetTracker;
}

/** 에러 객체에서 statusCode를 안전 추출(숫자가 아니면 undefined). */
function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const code = (error as { statusCode?: unknown }).statusCode;
  return typeof code === 'number' ? code : undefined;
}

/** 에러의 HTTP 상태 — 유효한 4xx/5xx면 그대로, 아니면 500. */
function resolveErrorStatus(error: unknown): number {
  const code = statusCodeOf(error);
  if (code !== undefined && code >= 400 && code < 600) return code;
  return 500;
}

/** 상태코드 → 에러 코드(일관 스키마). */
function errorCodeForStatus(status: number): string {
  if (status === 400) return 'INVALID_REQUEST';
  if (status < 500) return 'BAD_REQUEST';
  return 'INTERNAL_ERROR';
}

/** 사용자向 메시지 — 5xx는 내부 상세를 숨기고 일반 메시지(로그엔 원본 보존). */
function userMessageForStatus(status: number, error: unknown): string {
  if (status >= 500) return '서버 오류가 발생했습니다';
  if (error instanceof Error) return error.message;
  return '잘못된 요청';
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

  // 2단 캐시(ADR-0011): 스냅샷(데이터+리포트) 30분 + LLM 리포트 7일. 둘 다 인스턴스 스코프(테스트 격리).
  const cache = createTTLCache<GraphSnapshot>({ ttlMs: env.CACHE_TTL_MS });
  const reportCache = createTTLCache<UsageReport>({ ttlMs: env.REPORT_CACHE_TTL_MS });
  // 예산 서킷 브레이커(ADR-0013): 누적 추정 비용이 상한 도달 시 LLM 분석을 자동 차단 → 휴리스틱 폴백.
  const budget =
    opts.budget ??
    createBudgetTracker({
      capUsd: env.ANTHROPIC_BUDGET_USD,
      inputUsdPerMTok: env.ANALYSIS_INPUT_USD_PER_MTOK,
      outputUsdPerMTok: env.ANALYSIS_OUTPUT_USD_PER_MTOK,
    });
  const orchestrator = createSearchOrchestrator({
    cache,
    reportCache,
    adapters: opts.adapters,
    analyze: (query, items) => analyzeUsage(query, items, { budget }),
  });
  app.decorate('orchestrator', orchestrator);

  app.register(cors, { origin: env.CORS_ORIGIN });

  app.get('/health', async () => ({ status: 'ok' as const }));

  // LLM 예산 관측(ADR-0013): 누적 토큰·추정비용·상한·남은예산·서킷 오픈 여부를 노출한다.
  // 비민감 집계만 반환 — 키·시크릿 값은 절대 포함하지 않는다(getStats가 토큰 수·USD만 제공).
  app.get('/api/usage', async () => ({ budget: budget.getStats() }));

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

  // 미처리 예외·404도 일관된 에러 스키마(ApiError)로 응답한다(FOUNDATION-SPEC §4.1).
  // 사용자向 메시지와 로그를 분리: 5xx는 내부 상세를 숨기고 로그에만 원본을 남긴다.
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, '처리되지 않은 오류');
    const status = resolveErrorStatus(error);
    const body: ApiError = {
      error: { code: errorCodeForStatus(status), message: userMessageForStatus(status, error) },
    };
    return reply.code(status).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiError = { error: { code: 'NOT_FOUND', message: '경로를 찾을 수 없습니다' } };
    return reply.code(404).send(body);
  });

  return app;
}
