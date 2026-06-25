import { safeFetch, SafeFetchError } from '../lib/http.js';
import { createRateLimiter, withRetry } from '../lib/rate-limit.js';
import { env } from '../env.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const GOOGLE_HOST = 'www.googleapis.com';
const ALLOW_HOSTS = [GOOGLE_HOST];

interface GoogleItem {
  title?: string;
  link?: string;
  snippet?: string;
}
interface GoogleResponse {
  items?: GoogleItem[];
}

export interface GoogleDeps {
  apiKey?: string;
  cseId?: string;
  fetchImpl?: typeof fetch;
}

/**
 * 구글 Programmable Search(Custom Search JSON API) 어댑터(키 필요).
 * 무료 100회/일 — 캐시로 절약. 키 미설정 시 자동 비활성.
 * 참고: 2026-01 무료 전체웹 검색 종료 → CSE에 등록한 엄선 도메인(≤50)을 검색한다. (ADR-0003)
 */
export function createGoogleAdapter(deps: GoogleDeps = {}): SourceAdapter {
  const limiter = createRateLimiter(200);

  return {
    id: 'google',
    sourceType: 'google',
    requiresKey: true,
    isEnabled: () => Boolean(deps.apiKey && deps.cseId),
    async collect({ query, limit = 8, signal }: CollectContext): Promise<RawItem[]> {
      if (!deps.apiKey || !deps.cseId) return [];

      await limiter.acquire();
      const num = Math.max(1, Math.min(10, limit));
      const url =
        `https://${GOOGLE_HOST}/customsearch/v1` +
        `?key=${encodeURIComponent(deps.apiKey)}&cx=${encodeURIComponent(deps.cseId)}` +
        `&q=${encodeURIComponent(query)}&hl=ko&num=${num}`;

      const res = await withRetry(
        () =>
          safeFetch(url, {
            allowHosts: ALLOW_HOSTS,
            timeoutMs: 5000,
            signal,
            fetchImpl: deps.fetchImpl,
            headers: { accept: 'application/json' },
          }),
        { retries: 1, baseMs: 200, shouldRetry: isTransient },
      );

      if (!res.ok) return [];
      const data = (await res.json()) as GoogleResponse;
      return (data.items ?? []).map(toRawItem).filter((x): x is RawItem => x !== null);
    },
  };
}

export const googleAdapter = createGoogleAdapter({
  apiKey: env.GOOGLE_API_KEY,
  cseId: env.GOOGLE_CSE_ID,
});

function toRawItem(item: GoogleItem): RawItem | null {
  if (!item.link || !item.title) return null;
  try {
    new URL(item.link);
  } catch {
    return null;
  }
  return { title: item.title, url: item.link, snippet: item.snippet };
}

function isTransient(error: unknown): boolean {
  return error instanceof SafeFetchError && (error.code === 'NETWORK' || error.code === 'TIMEOUT');
}
