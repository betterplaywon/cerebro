import { z } from 'zod';
import { fetchJson } from '../lib/http.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { stripHtml } from '../lib/text.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const WIKI_HOST = 'ko.wikipedia.org';
const ALLOW_HOSTS = [WIKI_HOST];
const USER_AGENT = 'cerebro/0.1 (+https://github.com/betterplaywon/cerebro)';

/** 위키백과 REST 검색 응답(외부 경계 — zod 런타임 검증). 사용하는 필드만 선언, 나머지는 무시. */
const WikiSearchPageSchema = z.object({
  key: z.string().optional(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  description: z.string().optional(),
});
const WikiSearchResponseSchema = z.object({ pages: z.array(WikiSearchPageSchema).optional() });
type WikiSearchPage = z.infer<typeof WikiSearchPageSchema>;

/**
 * 위키백과(한국어) 검색 어댑터 — 키 불필요·무료·ToS 친화(공개 REST API).
 * 공식 REST 검색: GET /w/rest.php/v1/search/page?q=&limit=
 * 모든 외부 호출은 SSRF-safe fetch + rate limit + 지수 백오프를 거친다.
 */
export function createWikipediaAdapter(deps: { fetchImpl?: typeof fetch } = {}): SourceAdapter {
  // 단일 엔드포인트(쿼리당 1회)라 호출 간격은 정중함 수준(300ms)으로 충분.
  // 재시도 2회: Layer B는 일일 쿼터 압박이 없어 일시적 오류엔 회복력을 우선한다
  // (네이버/카카오 Layer A는 쿼터 절약 위해 fetchJson 기본 1회).
  const limiter = createRateLimiter(300);

  return {
    id: 'wikipedia',
    sourceType: 'wikipedia',
    layer: 'B', // CC BY-SA — 재가공·저장·수익화 허용(LLM 리포트·7일 캐시 입력 가능). ADR-0014.
    requiresKey: false,
    isEnabled: () => true,
    async collect({ query, limit = 8 }: CollectContext): Promise<RawItem[]> {
      await limiter.acquire();

      const url =
        `https://${WIKI_HOST}/w/rest.php/v1/search/page` +
        `?q=${encodeURIComponent(query)}&limit=${clamp(limit, 1, 20)}`;

      const data = await fetchJson(url, {
        allowHosts: ALLOW_HOSTS,
        fetchImpl: deps.fetchImpl,
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        retries: 2,
        schema: WikiSearchResponseSchema,
      });

      const pages = data?.pages ?? [];

      return pages
        .filter((p): p is WikiSearchPage & { title: string } => typeof p.title === 'string' && p.title.length > 0)
        .map((p) => ({
          title: p.title,
          url: `https://${WIKI_HOST}/wiki/${encodeURIComponent(p.key ?? p.title)}`,
          snippet: stripHtml(p.excerpt ?? p.description ?? '') || undefined,
        }));
    },
  };
}

export const wikipediaAdapter = createWikipediaAdapter();

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
