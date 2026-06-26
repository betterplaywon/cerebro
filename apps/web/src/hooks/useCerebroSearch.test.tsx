import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { withQueryClient } from '../test/render';
import { useCerebroSearch } from './useCerebroSearch';

describe('useCerebroSearch', () => {
  it('미검색 상태는 idle, 페칭 없음', () => {
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });
    expect(result.current.status).toBe('idle');
    expect(result.current.graph).toBeNull();
  });

  it('검색하면 ready로 전이하고 그래프를 돌려준다(중심 라벨=검색어)', async () => {
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });

    act(() => result.current.search('토스'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.graph?.subject.query).toBe('토스');
    expect(result.current.graph?.nodes.find((n) => n.kind === 'center')?.label).toBe('토스');
    expect(result.current.error).toBeNull();
  });

  it('서버 오류면 error 상태와 메시지를 노출한다', async () => {
    server.use(
      http.post('http://localhost:8787/api/search', () =>
        HttpResponse.json({ error: { code: 'X', message: '서버 폭발' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useCerebroSearch(), { wrapper: withQueryClient() });

    act(() => result.current.search('에러'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('서버 폭발');
    expect(result.current.graph).toBeNull();
  });
});
