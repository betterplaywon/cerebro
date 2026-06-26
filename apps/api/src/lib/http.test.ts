import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fetchJson, isTransientFetchError, safeFetch, SafeFetchError } from './http.js';

const ALLOW = ['ko.wikipedia.org'];

function okFetch() {
  return vi.fn(async () => new Response('{}', { status: 200 }));
}

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
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

describe('isTransientFetchError', () => {
  it('네트워크/타임아웃 오류만 일시적으로 본다', () => {
    expect(isTransientFetchError(new SafeFetchError('x', 'NETWORK'))).toBe(true);
    expect(isTransientFetchError(new SafeFetchError('x', 'TIMEOUT'))).toBe(true);
    expect(isTransientFetchError(new SafeFetchError('x', 'HOST_NOT_ALLOWED'))).toBe(false);
    expect(isTransientFetchError(new SafeFetchError('x', 'ABORT'))).toBe(false);
    expect(isTransientFetchError(new Error('x'))).toBe(false);
  });
});

describe('safeFetch 타임아웃 vs 외부 취소 구분', () => {
  /** 주어진 signal이 abort되면 거부하는 fetch 모킹(실제 네트워크 취소 흉내). */
  function abortAwareFetch() {
    return vi.fn((_url: URL, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
    );
  }

  it('타임아웃이면 TIMEOUT 코드로 던진다', async () => {
    const f = abortAwareFetch();
    await expect(
      safeFetch('https://ko.wikipedia.org/api', {
        allowHosts: ALLOW,
        fetchImpl: f as unknown as typeof fetch,
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('외부 signal 취소는 ABORT 코드로 던진다(타임아웃과 구분)', async () => {
    const ac = new AbortController();
    const f = abortAwareFetch();
    const p = safeFetch('https://ko.wikipedia.org/api', {
      allowHosts: ALLOW,
      fetchImpl: f as unknown as typeof fetch,
      signal: ac.signal,
      timeoutMs: 5000,
    });
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORT' });
  });

  it('fetchJson은 외부 취소(ABORT)를 재시도하지 않는다', async () => {
    const ac = new AbortController();
    let calls = 0;
    const f = vi.fn((_url: URL, init: RequestInit) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });
    const p = fetchJson('https://ko.wikipedia.org/api', {
      allowHosts: ALLOW,
      fetchImpl: f as unknown as typeof fetch,
      signal: ac.signal,
      retries: 3,
      retryBaseMs: 1,
    });
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORT' });
    expect(calls).toBe(1); // 재시도 없이 즉시 중단
  });
});

describe('fetchJson', () => {
  it('200 응답을 파싱해 반환한다', async () => {
    const f = jsonFetch({ ok: 1 });
    const data = await fetchJson<{ ok: number }>('https://ko.wikipedia.org/api', {
      allowHosts: ALLOW,
      fetchImpl: f,
    });
    expect(data).toEqual({ ok: 1 });
  });

  it('비정상 응답(5xx)이면 null을 반환한다', async () => {
    const f = jsonFetch({}, 503);
    const data = await fetchJson('https://ko.wikipedia.org/api', { allowHosts: ALLOW, fetchImpl: f });
    expect(data).toBeNull();
  });

  it('일시적 네트워크 오류는 재시도한 뒤 성공한다', async () => {
    let calls = 0;
    const f = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom'); // safeFetch가 NETWORK 오류로 감싼다 → 재시도
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    });
    const data = await fetchJson<{ ok: number }>('https://ko.wikipedia.org/api', {
      allowHosts: ALLOW,
      fetchImpl: f as unknown as typeof fetch,
      retries: 1,
      retryBaseMs: 1,
    });
    expect(calls).toBe(2);
    expect(data).toEqual({ ok: 1 });
  });

  it('schema가 있으면 검증 통과 데이터를 반환한다', async () => {
    const schema = z.object({ items: z.array(z.object({ id: z.number() })) });
    const data = await fetchJson('https://ko.wikipedia.org/api', {
      allowHosts: ALLOW,
      fetchImpl: jsonFetch({ items: [{ id: 1 }] }),
      schema,
    });
    expect(data).toEqual({ items: [{ id: 1 }] });
  });

  it('schema 검증 실패(외부 응답 형태 불일치)면 null', async () => {
    const schema = z.object({ items: z.array(z.object({ id: z.number() })) });
    const data = await fetchJson('https://ko.wikipedia.org/api', {
      allowHosts: ALLOW,
      fetchImpl: jsonFetch({ items: 'not-an-array' }), // 외부가 깨진 형태를 보내도 안전
      schema,
    });
    expect(data).toBeNull();
  });
});
