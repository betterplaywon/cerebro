import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('initialQuery로 입력칸을 채운다(딥링크 진입 반영)', () => {
    render(<SearchBar initialQuery="토스" onSearch={() => {}} />);
    expect(screen.getByLabelText<HTMLInputElement>('검색어').value).toBe('토스');
  });

  it('제출하면 공백을 제거한 검색어로 onSearch를 호출한다', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    fireEvent.change(screen.getByLabelText('검색어'), { target: { value: '  네이버  ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(onSearch).toHaveBeenCalledWith('네이버');
  });

  it('빈(공백) 검색어면 onSearch를 호출하지 않는다', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    fireEvent.change(screen.getByLabelText('검색어'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(onSearch).not.toHaveBeenCalled();
  });
});
