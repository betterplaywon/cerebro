import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EXAMPLE_QUERIES } from '@cerebro/shared';
import { SuggestedSearches } from './SuggestedSearches';

describe('SuggestedSearches', () => {
  it('SSOT 예시 검색어마다 칩을 렌더한다', () => {
    render(<SuggestedSearches onSelect={() => {}} />);
    for (const q of EXAMPLE_QUERIES) {
      expect(screen.getByRole('button', { name: q })).toBeTruthy();
    }
  });

  it('추천 칩을 누르면 해당 검색어로 onSelect를 호출한다', () => {
    const onSelect = vi.fn();
    render(<SuggestedSearches onSelect={onSelect} />);
    const [first] = EXAMPLE_QUERIES;

    fireEvent.click(screen.getByRole('button', { name: first }));

    expect(onSelect).toHaveBeenCalledWith(first);
  });
});
