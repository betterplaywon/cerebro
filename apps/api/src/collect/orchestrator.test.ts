import { describe, expect, it } from 'vitest';
import type { RawItem, SourceAdapter } from '../sources/types.js';
import { collectAll } from './orchestrator.js';

const NOW = '2026-06-25T00:00:00.000Z';

function stub(id: string, items: RawItem[]): SourceAdapter {
  return {
    id,
    sourceType: 'web',
    layer: 'A',
    requiresKey: false,
    isEnabled: () => true,
    collect: () => Promise.resolve(items),
  };
}

describe('collectAll', () => {
  it('여러 어댑터를 병합하고 URL 중복을 제거한다', async () => {
    const a = stub('a', [{ title: 'X', url: 'https://e.com/1', snippet: '토스' }]);
    const b = stub('b', [{ title: 'Y', url: 'https://e.com/1' }]);
    const res = await collectAll('토스', undefined, NOW, [a, b]);
    expect(res.usedAdapters).toEqual(['a', 'b']);
    expect(res.items).toHaveLength(1);
  });

  it('위험 스킴(javascript:) 링크 항목은 걸러낸다', async () => {
    const a = stub('a', [
      { title: 'OK', url: 'https://e.com/ok' },
      { title: 'XSS', url: 'javascript:alert(1)' },
    ]);
    const res = await collectAll('q', undefined, NOW, [a]);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.source.url).toBe('https://e.com/ok');
  });

  it('항목별 sourceType이 어댑터 기본 유형을 오버라이드한다', async () => {
    const multi: SourceAdapter = {
      id: 'multi',
      sourceType: 'naver',
      layer: 'A',
      requiresKey: false,
      isEnabled: () => true,
      collect: () =>
        Promise.resolve([
          { title: 'A', url: 'https://e.com/a', sourceType: 'community' },
          { title: 'B', url: 'https://e.com/b' }, // 오버라이드 없음 → 어댑터 기본(naver)
        ]),
    };
    const res = await collectAll('q', undefined, NOW, [multi]);
    const byUrl = Object.fromEntries(res.items.map((i) => [i.source.url, i.source.type]));
    expect(byUrl['https://e.com/a']).toBe('community');
    expect(byUrl['https://e.com/b']).toBe('naver');
  });

  it('실패한 어댑터는 건너뛰고 나머지로 진행한다', async () => {
    const ok = stub('ok', [{ title: 'X', url: 'https://e.com/1' }]);
    const bad: SourceAdapter = {
      id: 'bad',
      sourceType: 'web',
      layer: 'A',
      requiresKey: false,
      isEnabled: () => true,
      collect: () => Promise.reject(new Error('boom')),
    };
    const res = await collectAll('q', undefined, NOW, [ok, bad]);
    expect(res.usedAdapters).toEqual(['ok']);
    expect(res.failedAdapters).toEqual(['bad']);
    expect(res.items).toHaveLength(1);
  });
});
