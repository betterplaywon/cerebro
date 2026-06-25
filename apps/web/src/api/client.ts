import { SearchResponseSchema, type SearchResponse } from '@cerebro/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

/**
 * 검색 API 호출. 응답을 SSOT 스키마로 검증해 계약 위반을 런타임에 차단한다.
 */
export async function searchCerebro(query: string): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
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
