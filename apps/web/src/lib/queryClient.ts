import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query 클라이언트 — 브라우저측 L1 서버상태 캐시(ARCHITECTURE §2.1·§4).
 * 정책: 짧은 staleTime으로 재검색·뒤로가기를 무비용화하되(외부 쿼터 절약), 포커스 리페치는 끈다
 * (검색 앱 특성상 의도치 않은 재요청·과금 방지). 서버는 별도로 30분 캐시(L2)를 둔다.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5분: 재검색 즉시 응답(L1 hit)
        gcTime: 30 * 60 * 1000, // 30분: 네비게이션 후에도 캐시 유지
        retry: 1, // 일시적 오류 1회 재시도(서버도 자체 백오프)
        refetchOnWindowFocus: false,
      },
    },
  });
}
