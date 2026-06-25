import { describe, expect, it, vi } from 'vitest';
import { createWikipediaAdapter } from './wikipedia.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('wikipediaAdapter', () => {
  it('검색 결과를 RawItem으로 매핑하고 excerpt의 HTML을 제거한다', async () => {
    const payload = {
      pages: [
        {
          key: '토스_(기업)',
          title: '토스',
          excerpt: '대한민국의 <span class="searchmatch">핀테크</span> 기업',
          description: '핀테크',
        },
        { key: '비바리퍼블리카', title: '비바리퍼블리카', excerpt: '토스 운영사' },
      ],
    };
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(payload)));
    const adapter = createWikipediaAdapter({ fetchImpl });

    const items = await adapter.collect({ query: '토스' });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe('토스');
    expect(items[0]?.url).toBe(`https://ko.wikipedia.org/wiki/${encodeURIComponent('토스_(기업)')}`);
    expect(items[0]?.snippet).toBe('대한민국의 핀테크 기업');
  });

  it('빈 결과를 안전하게 처리한다', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ pages: [] })));
    const adapter = createWikipediaAdapter({ fetchImpl });
    expect(await adapter.collect({ query: '없는검색어' })).toEqual([]);
  });

  it('비정상 응답(5xx)이면 빈 배열을 반환한다', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({}, 503)));
    const adapter = createWikipediaAdapter({ fetchImpl });
    expect(await adapter.collect({ query: '토스' })).toEqual([]);
  });

  it('제목 없는 항목은 제외한다', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse({ pages: [{ excerpt: 'no title' }, { title: 'ok' }] })),
    );
    const adapter = createWikipediaAdapter({ fetchImpl });
    const items = await adapter.collect({ query: 'x' });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('ok');
  });

  it('HTML 엔티티를 정리해 노이즈를 줄인다', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({ pages: [{ title: 'X', excerpt: 'AT&amp;T 의 <b>제품</b> &#039;테스트&#039;' }] }),
      ),
    );
    const adapter = createWikipediaAdapter({ fetchImpl });
    const items = await adapter.collect({ query: 'x' });
    expect(items[0]?.snippet).toBe("AT&T 의 제품 '테스트'");
  });
});
