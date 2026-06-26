/**
 * 인메모리 TTL + LRU 캐시. 무료 운영의 핵심(외부 쿼터·지연 절약).
 * MVP는 프로세스 메모리; 추후 Supabase/Redis 캐시로 교체 가능(인터페이스 유지).
 */
export interface TTLCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  readonly size: number;
}

interface Entry<T> {
  value: T;
  expires: number;
}

export function createTTLCache<T>(opts: { ttlMs: number; maxEntries?: number }): TTLCache<T> {
  const max = opts.maxEntries ?? 500;
  const store = new Map<string, Entry<T>>();

  function get(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      store.delete(key);
      return undefined;
    }
    // LRU 터치: 최근 사용을 맨 뒤로
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  function set(key: string, value: T): void {
    store.delete(key);
    store.set(key, { value, expires: Date.now() + opts.ttlMs });
    while (store.size > max) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  }

  /**
   * 순수 존재 확인 — get()과 달리 LRU 순서를 건드리지 않는다.
   * (조회가 사용 순서를 바꾸면 다음 set의 eviction 대상이 달라지는 부수효과가 생긴다.)
   * 만료 항목은 정리하되, 이는 죽은 키 1개 제거라 다른 키의 LRU 순서에 영향이 없다.
   */
  function has(key: string): boolean {
    const entry = store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      store.delete(key);
      return false;
    }
    return true;
  }

  return {
    get,
    set,
    has,
    delete: (key) => void store.delete(key),
    get size() {
      return store.size;
    },
  };
}
