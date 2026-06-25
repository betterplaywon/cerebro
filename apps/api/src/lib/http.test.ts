import { describe, expect, it, vi } from 'vitest';
import { safeFetch, SafeFetchError } from './http.js';

const ALLOW = ['ko.wikipedia.org'];

function okFetch() {
  return vi.fn(async () => new Response('{}', { status: 200 }));
}

describe('safeFetch SSRF 가드', () => {
  it('http 스킴을 차단한다(fetch 호출 안 함)', async () => {
    const f = okFetch();
    await expect(
      safeFetch('http://ko.wikipedia.org/x', { allowHosts: ALLOW, fetchImpl: f }),
    ).rejects.toMatchObject({ code: 'SCHEME' });
    expect(f).not.toHaveBeenCalled();
  });

  it('IP 리터럴을 차단한다', async () => {
    const f = okFetch();
    await expect(
      safeFetch('https://169.254.169.254/latest/meta-data', { allowHosts: ['169.254.169.254'], fetchImpl: f }),
    ).rejects.toMatchObject({ code: 'IP_LITERAL' });
    expect(f).not.toHaveBeenCalled();
  });

  it('사설/예약 호스트를 차단한다', async () => {
    const f = okFetch();
    await expect(
      safeFetch('https://localhost/admin', { allowHosts: ['localhost'], fetchImpl: f }),
    ).rejects.toMatchObject({ code: 'PRIVATE_HOST' });
    expect(f).not.toHaveBeenCalled();
  });

  it('화이트리스트 밖 호스트를 차단한다', async () => {
    const f = okFetch();
    await expect(
      safeFetch('https://evil.example.com/x', { allowHosts: ALLOW, fetchImpl: f }),
    ).rejects.toMatchObject({ code: 'HOST_NOT_ALLOWED' });
    expect(f).not.toHaveBeenCalled();
  });

  it('리다이렉트를 차단한다', async () => {
    const f = vi.fn(async () => ({ type: 'opaqueredirect', status: 0 }) as unknown as Response);
    await expect(
      safeFetch('https://ko.wikipedia.org/x', { allowHosts: ALLOW, fetchImpl: f }),
    ).rejects.toMatchObject({ code: 'REDIRECT_BLOCKED' });
  });

  it('허용 호스트는 통과시킨다', async () => {
    const f = okFetch();
    const res = await safeFetch('https://ko.wikipedia.org/api', { allowHosts: ALLOW, fetchImpl: f });
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledOnce();
  });

  it('SafeFetchError 타입을 던진다', async () => {
    await expect(
      safeFetch('ftp://ko.wikipedia.org', { allowHosts: ALLOW, fetchImpl: okFetch() }),
    ).rejects.toBeInstanceOf(SafeFetchError);
  });
});
