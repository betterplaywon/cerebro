import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** 테스트용 MSW 서버 — FE 데이터 페칭(TanStack Query)을 실제 fetch 경계에서 모킹(QA-STRATEGY). */
export const server = setupServer(...handlers);
