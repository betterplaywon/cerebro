import { describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { createTTLCache } from './cache.js';

describe('createTTLCache', () => {
  it('set/get 동작', () => {
    const c = createTTLCache<number>({ ttlMs: 1000 });
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.has('a')).toBe(true);
    expect(c.get('none')).toBeUndefined();
  });

  it('TTL 만료 후 미스', async () => {
    const c = createTTLCache<number>({ ttlMs: 10 });
    c.set('a', 1);
    await delay(25);
    expect(c.get('a')).toBeUndefined();
    expect(c.has('a')).toBe(false);
  });

  it('maxEntries 초과 시 가장 오래된 항목을 제거한다', () => {
    const c = createTTLCache<number>({ ttlMs: 1000, maxEntries: 2 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.size).toBe(2);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });
});
