import { safeFetch, SafeFetchError } from '../lib/http.js';
import { createRateLimiter, withRetry } from '../lib/rate-limit.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const WIKI_HOST = 'ko.wikipedia.org';
const ALLOW_HOSTS = [WIKI_HOST];
const USER_AGENT = 'cerebro/0.1 (+https://github.com/betterplaywon/cerebro)';

interface WikiSearchPage {
  key?: string;
  title?: string;
  excerpt?: string;
  description?: string;
}
interface WikiSearchResponse {
  pages?: WikiSearchPage[];
}

/**
 * 위키백과(한국어) 검색 어댑터 — 키 불필요·무료·ToS 친화(공개 REST API).
 * 공식 REST 검색: GET /w/rest.php/v1/search/page?q=&limit=
 * 모든 외부 호출은 SSRF-safe fetch + rate limit + 지수 백오프를 거친다.
 */
export function createWikipediaAdapter(deps: { fetchImpl?: typeof fetch } = {}): SourceAdapter {
  const limiter = createRateLimiter(300);

  return {
    id: 'wikipedia',
    sourceType: 'wikipedia',
    requiresKey: false,
    isEnabled: () => true,
    async collect({ query, limit = 8, signal }: CollectContext): Promise<RawItem[]> {
      await limiter.acquire();

      const url =
        `https://${WIKI_HOST}/w/rest.php/v1/search/page` +
        `?q=${encodeURIComponent(query)}&limit=${clamp(limit, 1, 20)}`;

      const res = await withRetry(
        () =>
          safeFetch(url, {
            allowHosts: ALLOW_HOSTS,
            timeoutMs: 5000,
            signal,
            fetchImpl: deps.fetchImpl,
            headers: { accept: 'application/json', 'user-agent': USER_AGENT },
          }),
        { retries: 2, baseMs: 200, shouldRetry: isTransient },
      );

      if (!res.ok) return [];

      const data = (await res.json()) as WikiSearchResponse;
      const pages = data.pages ?? [];

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

function isTransient(error: unknown): boolean {
  return error instanceof SafeFetchError && (error.code === 'NETWORK' || error.code === 'TIMEOUT');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x?[0-9a-f]+;/gi, ' ') // 기타 수치 엔티티 제거(노이즈 방지)
    .replace(/&[a-z]+;/gi, ' ') // 기타 명명 엔티티 제거
    .replace(/\s+/g, ' ')
    .trim();
}
