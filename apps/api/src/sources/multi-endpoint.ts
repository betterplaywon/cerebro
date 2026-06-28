import type { z } from 'zod';
import { fetchJson } from '../lib/http.js';
import { stripHtml } from '../lib/text.js';
import type { RateLimiter } from '../lib/rate-limit.js';
import type { SourceType } from '@cerebro/shared';
import type { RawItem } from './types.js';

interface RawItemDraft {
  url?: string;
  title?: string;
  /** 정제 전 원문 스니펫(HTML 포함 가능) — buildRawItem이 stripHtml한다. */
  snippet?: string;
  /** ISO 8601 게시 시각(어댑터가 변환해 전달). */
  publishedAt?: string;
  sourceType?: SourceType;
}

/**
 * 외부 검색 항목 → RawItem 가드 단일화(naver/kakao 공유).
 * url·title 누락, new URL 실패, HTML 태그만이라 stripHtml 후 빈 제목 → 모두 null
 * (잘못된 링크·빈 라벨 노드 방지). url 형식·빈 제목 가드를 한 곳에 모아 드리프트를 막는다.
 * (위험 스킴 javascript:/data: 차단은 별도 — 수집 경계 orchestrator의 isHttpUrl이 담당.)
 */
export function buildRawItem(draft: RawItemDraft): RawItem | null {
  const { url, title, snippet, publishedAt, sourceType } = draft;
  if (!url || !title) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  const cleanTitle = stripHtml(title);
  if (!cleanTitle) return null;
  return {
    title: cleanTitle,
    url,
    snippet: stripHtml(snippet ?? '') || undefined,
    publishedAt,
    sourceType,
  };
}

/** 멀티엔드포인트 어댑터의 한 엔드포인트(경로 + 항목 출처유형). */
export interface EndpointSpec {
  readonly path: string;
  /** 항목별 출처 유형. 생략 시 어댑터 기본을 따른다(출처 투명성). */
  readonly sourceType?: SourceType;
}

export interface MultiEndpointConfig<TResponse, TItem> {
  readonly endpoints: readonly EndpointSpec[];
  readonly limiter: RateLimiter;
  readonly allowHosts: string[];
  readonly headers: Record<string, string>;
  readonly fetchImpl?: typeof fetch;
  readonly schema: z.ZodType<TResponse>;
  /** 엔드포인트 path로 요청 URL 구성(쿼리·페이지 파라미터 포함). */
  readonly buildUrl: (path: string) => string;
  /** 검증된 응답에서 항목 배열 추출(봉투키 items/documents 차이 흡수). */
  readonly extractItems: (data: TResponse) => readonly TItem[];
  /** 항목 + 엔드포인트 출처유형 → RawItem(buildRawItem 위임, 가드 포함). */
  readonly toRawItem: (item: TItem, sourceType: SourceType | undefined) => RawItem | null;
}

/**
 * 멀티엔드포인트 검색 어댑터(naver·kakao)의 공유 수집 골격.
 * 각 엔드포인트를 rate limit 직렬화 후 병렬 호출(allSettled — 일부 실패해도 성공분만 합침).
 * 어댑터별 차이(host·헤더·URL·스키마·매핑)는 config로만 주입한다.
 *
 * 멀티엔드포인트 어댑터가 현재 2개(rule-of-3 경계)지만 line-for-line 복붙 + 보안 가드 일관성을
 * 위해 추출한다. 트레이드오프 = ADR-0016.
 */
export async function collectFromEndpoints<TResponse, TItem>(
  config: MultiEndpointConfig<TResponse, TItem>,
): Promise<RawItem[]> {
  const { endpoints, limiter, allowHosts, headers, fetchImpl, schema, buildUrl, extractItems, toRawItem } =
    config;

  const perType = await Promise.allSettled(
    endpoints.map(async ({ path, sourceType }) => {
      await limiter.acquire();
      const data = await fetchJson(buildUrl(path), { allowHosts, fetchImpl, headers, schema });
      return (data ? extractItems(data) : [])
        .map((item) => toRawItem(item, sourceType))
        .filter((x): x is RawItem => x !== null);
    }),
  );

  return perType.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
