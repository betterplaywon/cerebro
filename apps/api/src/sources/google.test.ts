import { describe, expect, it } from 'vitest';
import { createGoogleAdapter } from './google.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('googleAdapter', () => {
  it('api키+cx 모두 있어야 활성화된다', () => {
    expect(createGoogleAdapter({}).isEnabled()).toBe(false);
    expect(createGoogleAdapter({ apiKey: 'a' }).isEnabled()).toBe(false);
    expect(createGoogleAdapter({ apiKey: 'a', cseId: 'b' }).isEnabled()).toBe(true);
  });

  it('비활성 어댑터의 collect는 빈 배열', async () => {
    expect(await createGoogleAdapter({}).collect({ query: 'x' })).toEqual([]);
  });

  it('검색 결과를 RawItem으로 매핑한다', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        jsonResponse({ items: [{ title: '토스', link: 'https://x.com/1', snippet: '핀테크 앱' }] }),
      )) as typeof fetch;
    const items = await createGoogleAdapter({ apiKey: 'k', cseId: 'c', fetchImpl }).collect({
      query: '토스',
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe('https://x.com/1');
    expect(items[0]?.snippet).toBe('핀테크 앱');
  });

  it('key/cx를 쿼리에 포함해 호출한다', async () => {
    let calledUrl = '';
    const fetchImpl = ((url: string | URL) => {
      calledUrl = String(url);
      return Promise.resolve(jsonResponse({ items: [] }));
    }) as typeof fetch;
    await createGoogleAdapter({ apiKey: 'mykey', cseId: 'mycx', fetchImpl }).collect({ query: 'x' });
    expect(calledUrl).toContain('key=mykey');
    expect(calledUrl).toContain('cx=mycx');
  });
});
