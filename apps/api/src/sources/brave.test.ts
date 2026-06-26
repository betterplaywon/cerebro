import { describe, expect, it } from 'vitest';
import { createBraveAdapter } from './brave.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('braveAdapter', () => {
  it('api키가 있어야 활성화된다', () => {
    expect(createBraveAdapter({}).isEnabled()).toBe(false);
    expect(createBraveAdapter({ apiKey: 'tok' }).isEnabled()).toBe(true);
  });

  it('비활성 어댑터의 collect는 빈 배열', async () => {
    expect(await createBraveAdapter({}).collect({ query: 'x' })).toEqual([]);
  });

  it('web.results를 RawItem으로 매핑한다(스니펫 마크업 제거)', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        jsonResponse({
          web: {
            results: [
              { title: '토스', url: 'https://x.com/1', description: '<strong>핀테크</strong> 앱' },
            ],
          },
        }),
      )) as typeof fetch;
    const items = await createBraveAdapter({ apiKey: 'tok', fetchImpl }).collect({ query: '토스' });
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe('https://x.com/1');
    expect(items[0]?.snippet).toBe('핀테크 앱');
  });

  it('구독 토큰을 헤더로, 쿼리를 q 파라미터로 보낸다', async () => {
    let calledUrl = '';
    let headers: Record<string, string> | undefined;
    const fetchImpl = ((url: string | URL, init?: RequestInit) => {
      calledUrl = String(url);
      headers = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(jsonResponse({ web: { results: [] } }));
    }) as typeof fetch;
    await createBraveAdapter({ apiKey: 'mytoken', fetchImpl }).collect({ query: '토스' });
    expect(calledUrl).toContain('/res/v1/web/search');
    expect(calledUrl).toContain('q=%ED%86%A0%EC%8A%A4');
    expect(headers?.['X-Subscription-Token']).toBe('mytoken');
  });
});
