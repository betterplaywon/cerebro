import { safeFetch, SafeFetchError } from '../lib/http.js';
import { createRateLimiter, withRetry } from '../lib/rate-limit.js';
import { stripHtml } from '../lib/text.js';
import { env } from '../env.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const BRAVE_HOST = 'api.search.brave.com';
const ALLOW_HOSTS = [BRAVE_HOST];

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  /** 원문 추정 게시일(ISO 8601), 있으면 */
  page_age?: string;
}
interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

export interface BraveDeps {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Brave Search(Web Search API) 어댑터(키 필요). 헤더 인증(X-Subscription-Token).
 * 독립 인덱스 광범위 웹검색 — 구글 Custom Search JSON API가 신규 고객에 닫혀(공식) 그 대체로 도입. (ADR-0005)
 * 무료 티어 ~1 req/s·월 2,000건 → 캐시(30분)로 절약. 키 미설정 시 registry에서 자동 제외(isEnabled()=false).
 * text_decorations=0: 스니펫의 하이라이트 마크업 제거(평문 수신). country/lang=KR/ko: 한국어 결과 우선.
 */
export function createBraveAdapter(deps: BraveDeps = {}): SourceAdapter {
  const limiter = createRateLimiter(1100); // 무료 티어 1 req/s 준수

  return {
    id: 'brave',
    sourceType: 'brave',
    requiresKey: true,
    isEnabled: () => Boolean(deps.apiKey),
    async collect({ query, limit = 8, signal }: CollectContext): Promise<RawItem[]> {
      const apiKey = deps.apiKey;
      if (!apiKey) return [];

      await limiter.acquire();
      const count = Math.max(1, Math.min(20, limit));
      const url =
        `https://${BRAVE_HOST}/res/v1/web/search` +
        `?q=${encodeURIComponent(query)}&count=${count}` +
        `&country=KR&search_lang=ko&ui_lang=ko&text_decorations=0`;

      const res = await withRetry(
        () =>
          safeFetch(url, {
            allowHosts: ALLOW_HOSTS,
            timeoutMs: 5000,
            signal,
            fetchImpl: deps.fetchImpl,
            headers: { accept: 'application/json', 'X-Subscription-Token': apiKey },
          }),
        { retries: 1, baseMs: 200, shouldRetry: isTransient },
      );

      if (!res.ok) return [];
      const data = (await res.json()) as BraveResponse;
      return (data.web?.results ?? []).map(toRawItem).filter((x): x is RawItem => x !== null);
    },
  };
}

export const braveAdapter = createBraveAdapter({ apiKey: env.BRAVE_SEARCH_API_KEY });

function toRawItem(item: BraveWebResult): RawItem | null {
  if (!item.url || !item.title) return null;
  try {
    new URL(item.url);
  } catch {
    return null;
  }
  return {
    title: stripHtml(item.title),
    url: item.url,
    snippet: stripHtml(item.description ?? '') || undefined,
    publishedAt: parseDate(item.page_age),
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
