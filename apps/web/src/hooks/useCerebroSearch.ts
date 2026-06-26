import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { GraphSnapshot, SearchResponse } from '@cerebro/shared';
import { searchQuery } from '../queries/search';
import { useUrlSearchParam } from './useUrlSearchParam';

/**
 * 검색 상태(판별 유니온). 불가능한 상태를 타입으로 차단한다:
 * `ready`면 graph가, `error`면 error가 **항상 존재**한다 — 소비자가 `&& graph` 같은 보강을 할 필요 없다.
 */
export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; graph: GraphSnapshot };

export interface CerebroSearch {
  state: SearchState;
  /** 현재 확정 검색어(URL `?q=`). 딥링크 시 입력칸 초기값 등 표시용. */
  query: string;
  /** 검색 실행 — URL(`?q=`)을 갱신하면 TanStack Query가 페칭·캐시·재시도를 담당 */
  search: (query: string) => void;
}

/** react-query 결과 + 검색어 → 합성된 SearchState. 상태와 데이터의 상관관계를 여기서 한 번에 묶는다. */
function toSearchState(query: string, result: UseQueryResult<SearchResponse>): SearchState {
  if (query.trim().length === 0) return { status: 'idle' };
  if (result.isError) return { status: 'error', error: toErrorMessage(result.error) };
  if (result.isSuccess) return { status: 'ready', graph: result.data.graph };
  return { status: 'loading' };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '알 수 없는 오류가 발생했습니다';
}

/**
 * 검색 데이터 페칭 훅 — 서버상태(GraphSnapshot)는 TanStack Query, 검색어(클라이언트 상태)는 URL이
 * 단일 진실원이다(ARCHITECTURE §2.1). 상태·데이터 **합성은 이 훅에서** 끝내고, 컴포넌트는 합성된
 * SearchState를 그대로 소비한다(관심사 분리·SRP).
 */
export function useCerebroSearch(): CerebroSearch {
  const [query, search] = useUrlSearchParam('q');
  const result = useQuery(searchQuery(query));

  return { state: toSearchState(query, result), query, search };
}
