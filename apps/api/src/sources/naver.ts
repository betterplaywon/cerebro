import { z } from 'zod';
import { createRateLimiter } from '../lib/rate-limit.js';
import { toIsoDate } from '../lib/dates.js';
import { env } from '../env.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';
import { buildRawItem, collectFromEndpoints, type EndpointSpec } from './multi-endpoint.js';

const NAVER_HOST = 'openapi.naver.com';
const ALLOW_HOSTS = [NAVER_HOST];

/**
 * 수집할 네이버 검색 엔드포인트와 출처 유형 매핑.
 * webkr/news 는 기본 유형(naver), blog/cafe/kin 은 유형 배지로 구분(출처 투명성).
 * 모두 동일 키·호스트·헤더·ToS(공식 공개 API) → 통합/법적 리스크 최소.
 *
 * 주의: 네이버 일일 호출 쿼터(25,000/일)는 전 엔드포인트 공유 →
 * 엔드포인트 수만큼 쿼리당 호출이 늘어난다. 30분 캐시로 완화하며,
 * 트래픽 증가 시 활성 엔드포인트 제한을 검토한다(현재는 YAGNI).
 */
const SEARCH_ENDPOINTS: readonly EndpointSpec[] = [
  { path: 'webkr' },
  { path: 'news' },
  { path: 'blog', sourceType: 'blog' },
  { path: 'cafearticle', sourceType: 'community' },
  { path: 'kin', sourceType: 'community' },
];

/** 네이버 검색 API 응답(외부 경계 — zod 런타임 검증). 사용하는 필드만 선언, 나머지는 무시. */
const NaverItemSchema = z.object({
  title: z.string().optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  pubDate: z.string().optional(),
});
const NaverResponseSchema = z.object({ items: z.array(NaverItemSchema).optional() });
type NaverItem = z.infer<typeof NaverItemSchema>;
type NaverResponse = z.infer<typeof NaverResponseSchema>;

export interface NaverDeps {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}

/**
 * 네이버 검색 API 어댑터(키 필요). 헤더 인증(X-Naver-Client-Id/Secret).
 * 키 미설정 시 isEnabled()=false 라 registry에서 자동 제외된다.
 * 멀티엔드포인트 수집 골격은 collectFromEndpoints 공유(ADR-0016).
 */
export function createNaverAdapter(deps: NaverDeps = {}): SourceAdapter {
  // 네이버 쿼터(25k/일·전 엔드포인트 공유) 보호 — 최소 호출 간격 120ms.
  const limiter = createRateLimiter(120);

  return {
    id: 'naver',
    sourceType: 'naver',
    layer: 'A', // 약관상 표시·단순캐시 전용 — LLM 재가공·7일 캐시·수익화 금지. ADR-0014.
    requiresKey: true,
    isEnabled: () => Boolean(deps.clientId && deps.clientSecret),
    async collect({ query, limit = 6 }: CollectContext): Promise<RawItem[]> {
      if (!deps.clientId || !deps.clientSecret) return [];
      const display = Math.max(1, Math.min(20, limit));

      return collectFromEndpoints<NaverResponse, NaverItem>({
        endpoints: SEARCH_ENDPOINTS,
        limiter,
        allowHosts: ALLOW_HOSTS,
        headers: {
          'X-Naver-Client-Id': deps.clientId,
          'X-Naver-Client-Secret': deps.clientSecret,
          accept: 'application/json',
        },
        fetchImpl: deps.fetchImpl,
        schema: NaverResponseSchema,
        buildUrl: (path) =>
          `https://${NAVER_HOST}/v1/search/${path}.json` +
          `?query=${encodeURIComponent(query)}&display=${display}`,
        extractItems: (data) => data.items ?? [],
        toRawItem: (item, sourceType) =>
          buildRawItem({
            url: item.link,
            title: item.title,
            snippet: item.description,
            publishedAt: toIsoDate(item.pubDate),
            sourceType,
          }),
      });
    },
  };
}

export const naverAdapter = createNaverAdapter({
  clientId: env.NAVER_CLIENT_ID,
  clientSecret: env.NAVER_CLIENT_SECRET,
});
