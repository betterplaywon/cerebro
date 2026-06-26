import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import App from './App';
import { renderWithClient } from './test/render';

describe('App', () => {
  it('랜딩에 브랜드와 검색 입력을 표시한다', () => {
    renderWithClient(<App />);
    expect(screen.getByText('cerebro')).toBeTruthy();
    expect(screen.getByLabelText('검색어')).toBeTruthy();
  });
});
