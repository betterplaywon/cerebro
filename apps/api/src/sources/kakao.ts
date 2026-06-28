import { z } from 'zod';
import { createRateLimiter } from '../lib/rate-limit.js';
import { toIsoDate } from '../lib/dates.js';
import { env } from '../env.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';
import { buildRawItem, collectFromEndpoints, type EndpointSpec } from './multi-endpoint.js';

const KAKAO_HOST = 'dapi.kakao.com';
const ALLOW_HOSTS = [KAKAO_HOST];

/**
 * 수집할 카카오(다음) 검색 엔드포인트와 출처 유형.
 * 다음 인덱스는 네이버가 못 잡는 국내 커뮤니티(예: 디시·클리앙 등)의 공개글을
 * 일부 포착 → 커뮤니티 커버리지를 합법(공식 공개 API)으로 보완한다.
 * (직접 크롤링은 ToS·robots·인증벽 위반이라 금지 — 검색 인덱스 경유만 허용)
 */
const SEARCH_ENDPOINTS: readonly EndpointSpec[] = [
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
type KakaoResponse = z.infer<typeof KakaoResponseSchema>;

export interface KakaoDeps {
  restApiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * 카카오 검색 API 어댑터(키 필요). 헤더 인증(Authorization: KakaoAK ...).
 * 키 미설정 시 isEnabled()=false 라 registry에서 자동 제외된다.
 * web/blog/cafe 3종을 collectFromEndpoints로 병렬 수집한다(SSRF-safe fetch + rate limit). ADR-0016.
 */
export function createKakaoAdapter(deps: KakaoDeps = {}): SourceAdapter {
  // 카카오 검색 쿼터 보호 — 최소 호출 간격 120ms.
  const limiter = createRateLimiter(120);

  return {
    id: 'kakao',
    sourceType: 'web',
    layer: 'A', // 약관상 표시·단순캐시 전용 — LLM 재가공·7일 캐시·수익화 금지. ADR-0014.
    requiresKey: true,
    isEnabled: () => Boolean(deps.restApiKey),
    async collect({ query, limit = 6 }: CollectContext): Promise<RawItem[]> {
      if (!deps.restApiKey) return [];
      const size = Math.max(1, Math.min(50, limit));

      return collectFromEndpoints<KakaoResponse, KakaoDocument>({
        endpoints: SEARCH_ENDPOINTS,
        limiter,
        allowHosts: ALLOW_HOSTS,
        headers: {
          Authorization: `KakaoAK ${deps.restApiKey}`,
          accept: 'application/json',
        },
        fetchImpl: deps.fetchImpl,
        schema: KakaoResponseSchema,
        buildUrl: (path) =>
          `https://${KAKAO_HOST}/v2/search/${path}` +
          `?query=${encodeURIComponent(query)}&size=${size}`,
        extractItems: (data) => data.documents ?? [],
        toRawItem: (doc, sourceType) =>
          buildRawItem({
            url: doc.url,
            title: doc.title,
            snippet: doc.contents,
            publishedAt: toIsoDate(doc.datetime),
            sourceType,
          }),
      });
    },
  };
}

export const kakaoAdapter = createKakaoAdapter({
  restApiKey: env.KAKAO_REST_API_KEY,
});
