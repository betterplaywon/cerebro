import { safeFetch, SafeFetchError } from '../lib/http.js';
import { createRateLimiter, withRetry } from '../lib/rate-limit.js';
import { stripHtml } from '../lib/text.js';
import { env } from '../env.js';
import type { SourceType } from '@cerebro/shared';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const NAVER_HOST = 'openapi.naver.com';
const ALLOW_HOSTS = [NAVER_HOST];

interface NaverEndpoint {
  /** 네이버 검색 API 경로(/v1/search/{path}.json) */
  readonly path: string;
  /** 항목별 출처 유형. 생략 시 어댑터 기본('naver'). */
  readonly sourceType?: SourceType;
}

/**
 * 수집할 네이버 검색 엔드포인트와 출처 유형 매핑.
 * webkr/news 는 기본 유형(naver), blog/cafe/kin 은 유형 배지로 구분(출처 투명성).
 * 모두 동일 키·호스트·헤더·ToS(공식 공개 API) → 통합/법적 리스크 최소.
 *
 * 주의: 네이버 일일 호출 쿼터(25,000/일)는 전 엔드포인트 공유 →
 * 엔드포인트 수만큼 쿼리당 호출이 늘어난다. 30분 캐시로 완화하며,
 * 트래픽 증가 시 활성 엔드포인트 제한을 검토한다(현재는 YAGNI).
 */
const SEARCH_ENDPOINTS: readonly NaverEndpoint[] = [
  { path: 'webkr' },
  { path: 'news' },
  { path: 'blog', sourceType: 'blog' },
  { path: 'cafearticle', sourceType: 'community' },
  { path: 'kin', sourceType: 'community' },
];

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
        SEARCH_ENDPOINTS.map(async ({ path, sourceType }) => {
          await limiter.acquire();
          const url =
            `https://${NAVER_HOST}/v1/search/${path}.json` +
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
          return (data.items ?? [])
            .map((item) => toRawItem(item, sourceType))
            .filter((x): x is RawItem => x !== null);
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

function toRawItem(item: NaverItem, sourceType: SourceType | undefined): RawItem | null {
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
    sourceType,
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
