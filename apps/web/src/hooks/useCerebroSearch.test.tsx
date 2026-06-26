import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { withQueryClient } from '../test/render';
import { useCerebroSearch } from './useCerebroSearch';

beforeEach(() => {
  // 검색어 진실원 = URL. 테스트 격리를 위해 매 테스트 전 URL을 초기화한다.
  window.history.replaceState(null, '', '/');
});

describe('useCerebroSearch', () => {
  it('URL에 ?q가 없으면 idle', () => {
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('검색하면 URL(?q)을 갱신하고 ready 상태에 graph가 담긴다', async () => {
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });

    act(() => result.current.search('토스'));

    expect(new URLSearchParams(window.location.search).get('q')).toBe('토스');
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    // ready면 graph가 타입·런타임 모두 보장된다.
    const { state } = result.current;
    expect(state.status === 'ready' && state.graph.subject.query).toBe('토스');
    expect(state.status === 'ready' && state.graph.nodes.find((n) => n.kind === 'center')?.label).toBe('토스');
  });

  it('초기 URL(?q=토스)에서 시작하면 즉시 검색을 수행한다(딥링크)', async () => {
    window.history.replaceState(null, '', '/?q=토스');
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });

  it('서버 오류면 error 상태에 메시지가 담긴다', async () => {
    server.use(
      http.post('http://localhost:8787/api/search', () =>
        HttpResponse.json({ error: { code: 'X', message: '서버 폭발' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });

    act(() => result.current.search('에러'));

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    const { state } = result.current;
    expect(state.status === 'error' && state.error).toBe('서버 폭발');
  });
});
