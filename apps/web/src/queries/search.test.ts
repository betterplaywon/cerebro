import { describe, expect, it } from 'vitest';
import { searchKeys, searchQuery } from './search';

describe('search query-factory', () => {
  it('키 팩토리는 단일 출처에서 일관된 키를 만든다', () => {
    expect(searchKeys.all).toEqual(['search']);
    expect(searchKeys.byQuery('토스')).toEqual(['search', '토스']);
  });

  it('옵션 팩토리는 키와 enabled 게이트를 함께 묶는다', () => {
    const opts = searchQuery('토스');
    expect(opts.queryKey).toEqual(['search', '토스']);
    expect(opts.enabled).toBe(true);
  });

  it('빈 검색어는 enabled=false (페칭 안 함)', () => {
    expect(searchQuery('').enabled).toBe(false);
  });
});
