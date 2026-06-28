import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SuggestedSearches } from './SuggestedSearches';

describe('SuggestedSearches', () => {
  it('추천 칩을 누르면 해당 검색어로 onSelect를 호출한다', () => {
    const onSelect = vi.fn();
    render(<SuggestedSearches onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '카카오' }));

    expect(onSelect).toHaveBeenCalledWith('카카오');
  });
});
