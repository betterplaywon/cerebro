import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** 테스트용 QueryClient — 재시도/캐시 비활성으로 결정적·빠르게. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

/** QueryClientProvider로 감싼 wrapper(renderHook용). */
export function withQueryClient(client = makeTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** 컴포넌트를 QueryClientProvider로 감싸 렌더. */
export function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={makeTestQueryClient()}>{ui}</QueryClientProvider>);
}
