import { describe, expect, it } from 'vitest';
import type { GraphSnapshot } from '@cerebro/shared';
import { createTTLCache } from '../lib/cache.js';
import { exampleAdapter } from '../sources/example.js';
import { buildSearchGraph, createSearchOrchestrator } from './search-orchestrator.js';

const NOW = '2026-06-26T00:00:00.000Z';

function newCache() {
  return createTTLCache<GraphSnapshot>({ ttlMs: 60_000 });
}

describe('buildSearchGraph (수집→빌드 파이프라인)', () => {
  it('어댑터 수집 결과로 중심-가지 그래프를 만든다', async () => {
    const graph = await buildSearchGraph('토스', undefined, NOW, [exampleAdapter]);
    expect(graph.subject.query).toBe('토스');
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('토스');
    expect(graph.nodes.length).toBeGreaterThan(1);
  });

  it('수집이 비면(빈 어댑터) 목업 그래프로 폴백한다', async () => {
    const empty = { ...exampleAdapter, collect: () => Promise.resolve([]) };
    const graph = await buildSearchGraph('빈검색', undefined, NOW, [empty]);
    // 목업은 항상 다수 노드를 채운다(데모 연속성)
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('빈검색');
  });

  it('어댑터가 throw해도 검색 루프가 끊기지 않고 그래프를 만든다(부분 실패 허용)', async () => {
    // 단일 어댑터 실패는 collectAll(allSettled)이 흡수 → 빈 결과 → 목업 폴백(catch 아님).
    const boom = { ...exampleAdapter, collect: () => Promise.reject(new Error('boom')) };
    const graph = await buildSearchGraph('에러', undefined, NOW, [boom]);
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('에러');
  });
});

describe('createSearchOrchestrator (캐시 read-through/write-back)', () => {
  it('첫 검색은 miss(cached=false), 동일 검색은 hit(cached=true)', async () => {
    const orchestrator = createSearchOrchestrator({ cache: newCache(), adapters: [exampleAdapter] });

    const first = await orchestrator.search('카카오', undefined, NOW);
    expect(first.cached).toBe(false);

    const second = await orchestrator.search('카카오', undefined, NOW);
    expect(second.cached).toBe(true);
    expect(second.graph).toBe(first.graph); // 동일 스냅샷 재사용
  });

  it('쿼리/타입이 다르면 별도 캐시 키', async () => {
    const orchestrator = createSearchOrchestrator({ cache: newCache(), adapters: [exampleAdapter] });
    await orchestrator.search('네이버', undefined, NOW);
    const other = await orchestrator.search('네이버', 'company', NOW);
    expect(other.cached).toBe(false);
  });
});
