import { SearchResponseSchema, type SearchResponse } from '@cerebro/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

/**
 * 검색 API 호출. 응답을 SSOT 스키마로 검증해 계약 위반을 런타임에 차단한다.
 * signal을 받아 fetch에 전달 → TanStack Query가 키 변경/언마운트 시 인플라이트 요청을 취소(레이스 방지).
 */
export async function searchCerebro(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error?: { message?: string } }).error?.message ?? '')
        : '';
    throw new Error(message || `검색에 실패했습니다 (${res.status})`);
  }

  return SearchResponseSchema.parse(await res.json());
}
