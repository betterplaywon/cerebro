/**
 * SSRF-안전 fetch. 데이터 수집은 외부 URL을 다루므로 반드시 이 함수를 거친다.
 * 방어: https 강제 · IP 리터럴/사설·예약 호스트 차단 · 호스트 화이트리스트 · 타임아웃 · 리다이렉트 차단.
 * (정규 URL을 쓰는 어댑터 전제 — 리다이렉트는 막아 내부망 우회를 차단)
 */

export type SafeFetchErrorCode =
  | 'SCHEME'
  | 'IP_LITERAL'
  | 'PRIVATE_HOST'
  | 'HOST_NOT_ALLOWED'
  | 'REDIRECT_BLOCKED'
  | 'TIMEOUT'
  | 'NETWORK';

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  constructor(message: string, code: SafeFetchErrorCode) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
  }
}

export interface SafeFetchOptions {
  /** 허용 호스트(정확 일치). 예: ['ko.wikipedia.org'] */
  allowHosts: string[];
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 테스트용 fetch 주입 (기본: 전역 fetch) */
  fetchImpl?: typeof fetch;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function isIpLiteral(host: string): boolean {
  return IPV4.test(host) || host.includes(':');
}

function isPrivateHost(host: string): boolean {
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }
  if (!IPV4.test(host)) return false;
  const [a, b] = host.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + 클라우드 메타데이터(169.254.169.254)
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError(`잘못된 URL: ${rawUrl}`, 'NETWORK');
  }

  if (url.protocol !== 'https:') throw new SafeFetchError('https만 허용됩니다', 'SCHEME');

  const host = url.hostname.toLowerCase();
  if (isIpLiteral(host)) throw new SafeFetchError(`IP 리터럴 차단: ${host}`, 'IP_LITERAL');
  if (isPrivateHost(host)) throw new SafeFetchError(`사설/예약 호스트 차단: ${host}`, 'PRIVATE_HOST');
  if (!opts.allowHosts.some((h) => h.toLowerCase() === host)) {
    throw new SafeFetchError(`허용되지 않은 호스트: ${host}`, 'HOST_NOT_ALLOWED');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  const onExternalAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onExternalAbort, { once: true });

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: opts.headers,
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new SafeFetchError('요청 시간 초과', 'TIMEOUT');
    throw new SafeFetchError(`네트워크 오류: ${(e as Error).message}`, 'NETWORK');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }

  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
    throw new SafeFetchError('리다이렉트가 차단되었습니다(정규 URL을 사용하세요)', 'REDIRECT_BLOCKED');
  }
  return res;
}
