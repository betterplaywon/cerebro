import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUrlSearchParam } from './useUrlSearchParam';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useUrlSearchParam', () => {
  it('초기 URL의 파라미터를 읽는다', () => {
    window.history.replaceState(null, '', '/?q=토스');
    const { result } = renderHook(() => useUrlSearchParam('q'));
    expect(result.current[0]).toBe('토스');
  });

  it('값을 설정하면 URL과 반환값이 갱신된다(trim 적용)', () => {
    const { result } = renderHook(() => useUrlSearchParam('q'));
    act(() => result.current[1]('  토스  '));
    expect(result.current[0]).toBe('토스');
    expect(new URLSearchParams(window.location.search).get('q')).toBe('토스');
  });

  it('빈 값이면 파라미터를 제거한다', () => {
    window.history.replaceState(null, '', '/?q=토스');
    const { result } = renderHook(() => useUrlSearchParam('q'));
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(window.location.search).toBe('');
  });

  it('외부 history 변경(popstate)을 구독해 반영한다(뒤로가기 동작)', () => {
    const { result } = renderHook(() => useUrlSearchParam('q'));
    expect(result.current[0]).toBe('');
    act(() => {
      window.history.replaceState(null, '', '/?q=네이버');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0]).toBe('네이버');
  });
});
