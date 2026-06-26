import { useQuery, type QueryStatus } from '@tanstack/react-query';
import type { GraphSnapshot } from '@cerebro/shared';
import { searchQuery } from '../queries/search';
import { useUrlSearchParam } from './useUrlSearchParam';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CerebroSearch {
  status: SearchStatus;
  graph: GraphSnapshot | null;
  error: string | null;
  /** 현재 검색어(URL `?q=`). 빈 문자열이면 미검색 */
  query: string;
  /** 검색 실행 — URL을 갱신하면 TanStack Query가 페칭·캐시·재시도를 담당 */
  search: (query: string) => void;
}

/** react-query status → 앱 SearchStatus 매핑(객체 매핑 — 중첩 삼항 제거). */
const SEARCH_STATUS_BY_QUERY_STATUS: Record<QueryStatus, SearchStatus> = {
  pending: 'loading',
  error: 'error',
  success: 'ready',
};

/** 검색어 유무 + 쿼리 상태 → 표시 상태(단일 책임). */
function deriveStatus(query: string, queryStatus: QueryStatus): SearchStatus {
  if (query.trim().length === 0) return 'idle';
  return SEARCH_STATUS_BY_QUERY_STATUS[queryStatus];
}

/** 쿼리 에러 → 사용자 메시지(없으면 null). */
function toErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return '알 수 없는 오류가 발생했습니다';
}

/**
 * 검색 데이터 페칭 훅 — 서버상태(GraphSnapshot)는 TanStack Query, 검색어(클라이언트 상태)는 URL이
 * 단일 진실원이다(ARCHITECTURE §2.1). 서버/클라이언트 상태를 분리하고, 쿼리 정의는 query-factory
 * (`searchQuery`)가 소유한다. 이 훅의 책임은 둘을 잇고 표시 상태로 정규화하는 것뿐(SRP).
 */
export function useCerebroSearch(): CerebroSearch {
  const [query, search] = useUrlSearchParam('q');
  const result = useQuery(searchQuery(query));

  return {
    status: deriveStatus(query, result.status),
    graph: result.data?.graph ?? null,
    error: toErrorMessage(result.error),
    query,
    search,
  };
}
