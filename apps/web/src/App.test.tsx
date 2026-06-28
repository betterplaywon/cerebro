import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import App from './App';
import { server } from './test/msw/server';
import { renderWithClient } from './test/render';

const IDLE_HINT = /마인드맵을 펼쳐보세요/;

beforeEach(() => {
  // 검색어 진실원 = URL. 테스트 격리를 위해 매 테스트 전 URL을 초기화한다.
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('랜딩에 브랜드와 검색 입력을 표시한다', () => {
    renderWithClient(<App />);
    expect(screen.getByText('cerebro')).toBeTruthy();
    expect(screen.getByLabelText('검색어')).toBeTruthy();
  });

  it('idle(결과 없음)에선 로고 버튼이 비활성이다 — 초기화할 결과가 없으므로', () => {
    renderWithClient(<App />);
    expect(screen.getByRole('button', { name: /홈으로/ })).toBeDisabled();
  });

  it('로고 클릭 시 결과를 지우고 홈(idle)으로 돌아간다 — URL·입력칸까지 초기화', async () => {
    // 에러 상태를 경유: non-idle이면서 3D 캔버스를 마운트하지 않아 가볍고 결정적.
    server.use(
      http.post('http://localhost:8787/api/search', () =>
        HttpResponse.json({ error: { code: 'X', message: '서버 폭발' } }, { status: 500 }),
      ),
    );
    window.history.replaceState(null, '', '/?q=토스'); // 딥링크 → 즉시 검색
    renderWithClient(<App />);

    await screen.findByRole('alert'); // 결과(에러) 표시 상태
    const logo = screen.getByRole('button', { name: /홈으로/ });
    expect(logo).toBeEnabled();

    fireEvent.click(logo);

    expect(screen.getByText(IDLE_HINT)).toBeTruthy(); // 홈 힌트 복귀
    expect(new URLSearchParams(window.location.search).get('q')).toBeNull(); // URL 초기화
    expect(screen.getByLabelText<HTMLInputElement>('검색어').value).toBe(''); // 입력 드래프트 초기화
  });
});
