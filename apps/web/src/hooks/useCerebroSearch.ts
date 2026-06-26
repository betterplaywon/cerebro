import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GraphSnapshot } from '@cerebro/shared';
import { searchQuery } from '../queries/search';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CerebroSearch {
  status: SearchStatus;
  graph: GraphSnapshot | null;
  error: string | null;
  /** 현재 검색어(빈 문자열이면 미검색) */
  query: string;
  /** 검색 실행(검색어 설정 → TanStack Query가 페칭·캐시·재시도 담당) */
  search: (query: string) => void;
}

/**
 * 검색 데이터 페칭 훅 — 서버상태(GraphSnapshot)를 TanStack Query로 관리한다(ARCHITECTURE §2.1).
 * 쿼리 정의(키·queryFn·enabled)는 query-factory(`searchQuery`)에 외부화하고, 이 훅은
 * 현재 검색어 상태와 4-상태 정규화만 담당한다(관심사 분리·결합도↓).
 * 같은 검색어 재요청은 L1 캐시로 즉시 응답(무비용), 일시적 오류는 재시도, 중복 요청은 dedupe된다.
 */
export function useCerebroSearch(): CerebroSearch {
  const [query, setQuery] = useState('');

  const result = useQuery(searchQuery(query));

  const search = useCallback((next: string) => {
    setQuery(next.trim());
  }, []);

  // react-query 상태를 앱의 4-상태 머신으로 정규화.
  // 캐시 히트면 data가 즉시 있어 loading 깜빡임 없이 ready로 간다(재검색 무비용).
  const status: SearchStatus =
    query.length === 0 ? 'idle' : result.isError ? 'error' : result.data ? 'ready' : 'loading';

  return {
    status,
    graph: result.data?.graph ?? null,
    error: result.isError ? errorMessage(result.error) : null,
    query,
    search,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
}
