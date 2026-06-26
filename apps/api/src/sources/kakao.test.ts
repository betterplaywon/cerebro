import { describe, expect, it } from 'vitest';
import { createKakaoAdapter } from './kakao.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('kakaoAdapter', () => {
  it('REST 키가 있어야 활성화된다', () => {
    expect(createKakaoAdapter({}).isEnabled()).toBe(false);
    expect(createKakaoAdapter({ restApiKey: 'k' }).isEnabled()).toBe(true);
  });

  it('비활성 어댑터의 collect는 빈 배열', async () => {
    expect(await createKakaoAdapter({}).collect({ query: 'x' })).toEqual([]);
  });

  it('KakaoAK 인증 헤더를 전달한다', async () => {
    let auth: string | undefined;
    const fetchImpl = ((_url: string | URL, init?: RequestInit) => {
      auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return Promise.resolve(jsonResponse({ documents: [] }));
    }) as typeof fetch;

    await createKakaoAdapter({ restApiKey: 'mykey', fetchImpl }).collect({ query: 'x' });

    expect(auth).toBe('KakaoAK mykey');
  });

  it('web/blog/cafe 3종을 호출하고 documents를 HTML 제거 후 매핑한다', async () => {
    let count = 0;
    const fetchImpl = (() => {
      count += 1;
      return Promise.resolve(
        jsonResponse({
          documents: [
            {
              title: '<b>토스</b> 후기',
              contents: '정말 <b>편하다</b>',
              url: 'https://e.com/1',
              datetime: '2023-05-01T12:00:00.000+09:00',
            },
          ],
        }),
      );
    }) as typeof fetch;

    const items = await createKakaoAdapter({ restApiKey: 'k', fetchImpl }).collect({ query: '토스' });

    expect(count).toBe(3);
    expect(items).toHaveLength(3);
    expect(items[0]?.title).toBe('토스 후기');
    expect(items[0]?.snippet).toBe('정말 편하다');
    expect(items[0]?.publishedAt).toBe(new Date('2023-05-01T12:00:00.000+09:00').toISOString());
  });

  it('web→web, blog→blog, cafe→community 으로 항목별 유형을 매긴다', async () => {
    const fetchImpl = ((url: string | URL) => {
      const path = String(url).match(/\/v2\/search\/(\w+)/)?.[1] ?? '?';
      return Promise.resolve(
        jsonResponse({ documents: [{ title: path, contents: 'c', url: `https://e.com/${path}` }] }),
      );
    }) as typeof fetch;

    const items = await createKakaoAdapter({ restApiKey: 'k', fetchImpl }).collect({ query: 'x' });
    const byPath = Object.fromEntries(items.map((it) => [it.title, it.sourceType]));

    expect(byPath.web).toBe('web');
    expect(byPath.blog).toBe('blog');
    expect(byPath.cafe).toBe('community');
  });
});
