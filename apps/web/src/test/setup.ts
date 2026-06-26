import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// 데이터 페칭 테스트는 MSW로 HTTP 경계를 모킹한다. 미등록 요청은 에러로 드러낸다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
