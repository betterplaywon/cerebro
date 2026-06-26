import { useCallback, useSyncExternalStore } from 'react';

/**
 * URL 검색 파라미터를 단일 진실원으로 다루는 훅.
 *
 * 왜 URL인가: 검색어를 컴포넌트 state(또는 전역 store)에 두면 "무엇을 검색 중인가"의 진실원이
 * 클라이언트 상태와 TanStack Query 캐시로 이중화된다. URL을 진실원으로 삼으면 그 이중화가
 * 사라지고, 공유·북마크·뒤로가기·딥링크가 추가 코드 없이 따라온다(마인드맵 공유와 정합).
 *
 * 구현: `useSyncExternalStore`로 브라우저 history(외부 store)를 구독한다 — URL을 React state로
 * '미러링'하지 않고 직접 읽는다. pushState는 popstate를 발생시키지 않으므로 쓰기 후 수동 디스패치한다.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function readParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

export function useUrlSearchParam(key: string): readonly [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readParam(key),
    () => '', // 서버 스냅샷(브라우저 전용 SPA라 빈 값)
  );

  const setValue = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      const url = new URL(window.location.href);
      if (trimmed) {
        url.searchParams.set(key, trimmed);
      } else {
        url.searchParams.delete(key);
      }
      if (url.href === window.location.href) return; // 동일 값이면 히스토리 노이즈 방지
      window.history.pushState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate')); // 구독자(useSyncExternalStore)에 통지
    },
    [key],
  );

  return [value, setValue] as const;
}
