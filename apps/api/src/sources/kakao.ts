import { z } from 'zod';
import { fetchJson } from '../lib/http.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { stripHtml } from '../lib/text.js';
import { toIsoDate } from '../lib/dates.js';
import { env } from '../env.js';
import type { SourceType } from '@cerebro/shared';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

const KAKAO_HOST = 'dapi.kakao.com';
const ALLOW_HOSTS = [KAKAO_HOST];

interface KakaoEndpoint {
  /** 카카오 검색 API 경로(/v2/search/{path}) */
  readonly path: string;
  /** 항목별 출처 유형 */
  readonly sourceType: SourceType;
}

/**
 * 수집할 카카오(다음) 검색 엔드포인트와 출처 유형.
 * 다음 인덱스는 네이버가 못 잡는 국내 커뮤니티(예: 디시·클리앙 등)의 공개글을
 * 일부 포착 → 커뮤니티 커버리지를 합법(공식 공개 API)으로 보완한다.
 * (직접 크롤링은 ToS·robots·인증벽 위반이라 금지 — 검색 인덱스 경유만 허용)
 */
const SEARCH_ENDPOINTS: readonly KakaoEndpoint[] = [
  { path: 'web', sourceType: 'web' },
  { path: 'blog', sourceType: 'blog' },
  { path: 'cafe', sourceType: 'community' },
];

/** 카카오 검색 API 응답(외부 경계 — zod 런타임 검증). 사용하는 필드만 선언, 나머지는 무시. */
const KakaoDocumentSchema = z.object({
  title: z.string().optional(),
  contents: z.string().optional(),
  url: z.string().optional(),
  datetime: z.string().optional(),
});
const KakaoResponseSchema = z.object({ documents: z.array(KakaoDocumentSchema).optional() });
type KakaoDocument = z.infer<typeof KakaoDocumentSchema>;

export interface KakaoDeps {
  restApiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * 카카오 검색 API 어댑터(키 필요). 헤더 인증(Authorization: KakaoAK ...).
 * 키 미설정 시 isEnabled()=false 라 registry에서 자동 제외된다.
 * web/blog/cafe 3종을 병렬 수집한다(SSRF-safe fetch + rate limit + 지수 백오프).
 */
export function createKakaoAdapter(deps: KakaoDeps = {}): SourceAdapter {
  const limiter = createRateLimiter(120);

  return {
    id: 'kakao',
    sourceType: 'web',
    requiresKey: true,
    isEnabled: () => Boolean(deps.restApiKey),
    async collect({ query, limit = 6, signal }: CollectContext): Promise<RawItem[]> {
      if (!deps.restApiKey) return [];

      const headers: Record<string, string> = {
        Authorization: `KakaoAK ${deps.restApiKey}`,
        accept: 'application/json',
      };
      const size = Math.max(1, Math.min(50, limit));

      const perType = await Promise.allSettled(
        SEARCH_ENDPOINTS.map(async ({ path, sourceType }) => {
          await limiter.acquire();
          const url =
            `https://${KAKAO_HOST}/v2/search/${path}` +
            `?query=${encodeURIComponent(query)}&size=${size}`;
          const data = await fetchJson(url, {
            allowHosts: ALLOW_HOSTS,
            timeoutMs: 5000,
            signal,
            fetchImpl: deps.fetchImpl,
            headers,
            schema: KakaoResponseSchema,
          });
          return (data?.documents ?? [])
            .map((doc) => toRawItem(doc, sourceType))
            .filter((x): x is RawItem => x !== null);
        }),
      );

      return perType.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    },
  };
}

export const kakaoAdapter = createKakaoAdapter({
  restApiKey: env.KAKAO_REST_API_KEY,
});

function toRawItem(doc: KakaoDocument, sourceType: SourceType): RawItem | null {
  if (!doc.url || !doc.title) return null;
  try {
    new URL(doc.url);
  } catch {
    return null;
  }
  const title = stripHtml(doc.title);
  if (!title) return null;
  return {
    title,
    url: doc.url,
    snippet: stripHtml(doc.contents ?? '') || undefined,
    publishedAt: toIsoDate(doc.datetime),
    sourceType,
  };
}
