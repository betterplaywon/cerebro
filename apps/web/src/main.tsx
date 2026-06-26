import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { createQueryClient } from './lib/queryClient';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root 엘리먼트를 찾을 수 없습니다');

// composition root: 서버상태(TanStack Query) 프로바이더를 앱 트리 최상단에 둔다.
const queryClient = createQueryClient();

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
