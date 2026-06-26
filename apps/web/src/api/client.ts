import { ApiErrorSchema, SearchResponseSchema, type SearchResponse } from '@cerebro/shared';

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

  if (!res.ok) throw new Error(await errorMessage(res));

  return SearchResponseSchema.parse(await res.json());
}

/**
 * 에러 응답에서 사용자 메시지를 추출한다 — 성공 경로와 동일하게 SSOT(ApiErrorSchema)로 검증.
 * 스키마 불일치(비표준 에러 본문)면 상태 코드 기반 기본 메시지로 폴백한다.
 */
async function errorMessage(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  const parsed = ApiErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : `검색에 실패했습니다 (${res.status})`;
}
