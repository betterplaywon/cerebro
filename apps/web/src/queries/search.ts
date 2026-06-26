import { queryOptions } from '@tanstack/react-query';
import { searchCerebro } from '../api/client';

/**
 * 검색 쿼리 팩토리 (query-factory 패턴).
 * 쿼리 키와 옵션 정의를 한 곳에 모아, 컴포넌트·훅은 이 팩토리를 소비만 한다
 * (인라인 키/queryFn 구성 금지 → 키 드리프트 차단, 응집도↑·결합도↓).
 */

/** 쿼리 키 팩토리 — 무효화·프리페치·setQueryData가 동일 키를 공유하도록 단일 출처화. */
export const searchKeys = {
  all: ['search'] as const,
  byQuery: (query: string) => [...searchKeys.all, query] as const,
};

/**
 * 검색 쿼리 옵션 팩토리 — 키·queryFn·enabled를 한 정의로 묶는다.
 * useQuery / prefetchQuery / ensureQueryData 등이 동일 정의를 재사용한다.
 * queryFn은 TanStack이 주는 signal을 fetch로 전달해 인플라이트 요청 취소를 지원한다.
 */
export function searchQuery(query: string) {
  return queryOptions({
    queryKey: searchKeys.byQuery(query),
    queryFn: ({ signal }) => searchCerebro(query, signal),
    enabled: query.trim().length > 0, // URL 직접 편집 등으로 공백만 들어와도 페칭하지 않음
  });
}
