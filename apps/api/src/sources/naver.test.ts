import { describe, expect, it } from 'vitest';
import { createNaverAdapter } from './naver.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('naverAdapter', () => {
  it('키가 모두 있어야 활성화된다', () => {
    expect(createNaverAdapter({}).isEnabled()).toBe(false);
    expect(createNaverAdapter({ clientId: 'a' }).isEnabled()).toBe(false);
    expect(createNaverAdapter({ clientId: 'a', clientSecret: 'b' }).isEnabled()).toBe(true);
  });

  it('비활성 어댑터의 collect는 빈 배열', async () => {
    expect(await createNaverAdapter({}).collect({ query: 'x' })).toEqual([]);
  });

  it('webkr+news 두 번 호출하고 HTML 제거 후 합친다', async () => {
    let count = 0;
    const fetchImpl = (() => {
      count += 1;
      return Promise.resolve(
        jsonResponse({
          items: [
            {
              title: '<b>토스</b> 소개',
              link: 'https://x.com/1',
              description: '핀테크 <b>앱</b>',
              pubDate: 'Mon, 26 Sep 2016 07:50:00 +0900',
            },
          ],
        }),
      );
    }) as typeof fetch;

    const items = await createNaverAdapter({ clientId: 'a', clientSecret: 'b', fetchImpl }).collect({
      query: '토스',
    });

    expect(count).toBe(2);
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe('토스 소개');
    expect(items[0]?.snippet).toBe('핀테크 앱');
    expect(items[0]?.publishedAt).toBe(new Date('Mon, 26 Sep 2016 07:50:00 +0900').toISOString());
  });

  it('인증 헤더를 전달한다', async () => {
    let headers: Record<string, string> | undefined;
    const fetchImpl = ((_url: string | URL, init?: RequestInit) => {
      headers = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(jsonResponse({ items: [] }));
    }) as typeof fetch;

    await createNaverAdapter({ clientId: 'id', clientSecret: 'sec', fetchImpl }).collect({ query: 'x' });

    expect(headers?.['X-Naver-Client-Id']).toBe('id');
    expect(headers?.['X-Naver-Client-Secret']).toBe('sec');
  });
});
