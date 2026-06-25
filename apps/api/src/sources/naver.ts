import { safeFetch, SafeFetchError } from '../lib/http.js';
import { createRateLimiter, withRetry } from '../lib/rate-limit.js';
import { stripHtml } from '../lib/text.js';
import { env } from '../env.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const NAVER_HOST = 'openapi.naver.com';
const ALLOW_HOSTS = [NAVER_HOST];
/** 사용할 검색 종류(웹문서 + 뉴스). 필요 시 blog/encyc/local 등 추가 가능. */
const SEARCH_TYPES = ['webkr', 'news'] as const;

interface NaverItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}
interface NaverResponse {
  items?: NaverItem[];
}

export interface NaverDeps {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}

/**
 * 네이버 검색 API 어댑터(키 필요). 헤더 인증(X-Naver-Client-Id/Secret).
 * 키 미설정 시 isEnabled()=false 라 registry에서 자동 제외된다.
 */
export function createNaverAdapter(deps: NaverDeps = {}): SourceAdapter {
  const limiter = createRateLimiter(120);

  return {
    id: 'naver',
    sourceType: 'naver',
    requiresKey: true,
    isEnabled: () => Boolean(deps.clientId && deps.clientSecret),
    async collect({ query, limit = 6, signal }: CollectContext): Promise<RawItem[]> {
      if (!deps.clientId || !deps.clientSecret) return [];

      const headers: Record<string, string> = {
        'X-Naver-Client-Id': deps.clientId,
        'X-Naver-Client-Secret': deps.clientSecret,
        accept: 'application/json',
      };
      const display = Math.max(1, Math.min(20, limit));

      const perType = await Promise.allSettled(
        SEARCH_TYPES.map(async (type) => {
          await limiter.acquire();
          const url =
            `https://${NAVER_HOST}/v1/search/${type}.json` +
            `?query=${encodeURIComponent(query)}&display=${display}`;
          const res = await withRetry(
            () =>
              safeFetch(url, {
                allowHosts: ALLOW_HOSTS,
                timeoutMs: 5000,
                signal,
                fetchImpl: deps.fetchImpl,
                headers,
              }),
            { retries: 1, baseMs: 200, shouldRetry: isTransient },
          );
          if (!res.ok) return [];
          const data = (await res.json()) as NaverResponse;
          return (data.items ?? []).map(toRawItem).filter((x): x is RawItem => x !== null);
        }),
      );

      return perType.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    },
  };
}

export const naverAdapter = createNaverAdapter({
  clientId: env.NAVER_CLIENT_ID,
  clientSecret: env.NAVER_CLIENT_SECRET,
});

function toRawItem(item: NaverItem): RawItem | null {
  if (!item.link || !item.title) return null;
  try {
    new URL(item.link);
  } catch {
    return null;
  }
  return {
    title: stripHtml(item.title),
    url: item.link,
    snippet: stripHtml(item.description ?? '') || undefined,
    publishedAt: parseDate(item.pubDate),
  };
}

function parseDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function isTransient(error: unknown): boolean {
  return error instanceof SafeFetchError && (error.code === 'NETWORK' || error.code === 'TIMEOUT');
}
