import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { GraphSnapshot } from '@cerebro/shared';
import { env } from '../env.js';
import { createTTLCache } from '../lib/cache.js';
import { exampleAdapter } from '../sources/example.js';
import { analyzeUsage, type UsageReport } from '../analyze/report.js';
import type { SourceAdapter } from '../sources/types.js';
import {
  buildSearchGraph,
  createSearchOrchestrator,
  searchCacheKey,
} from './search-orchestrator.js';

const NOW = '2026-06-26T00:00:00.000Z';

function newSnapshotCache() {
  return createTTLCache<GraphSnapshot>({ ttlMs: 60_000 });
}

function newReportCache() {
  return createTTLCache<UsageReport>({ ttlMs: 60_000 });
}

describe('buildSearchGraph (수집→빌드 파이프라인)', () => {
  it('어댑터 수집 결과로 중심-가지 그래프를 만든다', async () => {
    const graph = await buildSearchGraph('토스', undefined, NOW, { adapters: [exampleAdapter] });
    expect(graph.subject.query).toBe('토스');
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('토스');
    expect(graph.nodes.length).toBeGreaterThan(1);
  });

  it('수집이 비면(빈 어댑터) 목업 그래프로 폴백한다', async () => {
    const empty = { ...exampleAdapter, collect: () => Promise.resolve([]) };
    const graph = await buildSearchGraph('빈검색', undefined, NOW, { adapters: [empty] });
    // 목업은 항상 다수 노드를 채운다(데모 연속성)
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('빈검색');
  });

  it('어댑터가 throw해도 검색 루프가 끊기지 않고 그래프를 만든다(부분 실패 허용)', async () => {
    // 단일 어댑터 실패는 collectAll(allSettled)이 흡수 → 빈 결과 → 목업 폴백(catch 아님).
    const boom = { ...exampleAdapter, collect: () => Promise.reject(new Error('boom')) };
    const graph = await buildSearchGraph('에러', undefined, NOW, { adapters: [boom] });
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('에러');
  });

  it('resolveReport 실패는 휴리스틱 그래프로 폴백한다(검색 끊김 방지)', async () => {
    const resolveReport = () => Promise.reject(new Error('llm down'));
    const graph = await buildSearchGraph('실패주체', undefined, NOW, {
      adapters: [exampleAdapter],
      resolveReport,
    });
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('실패주체');
    // usage 노드 없이도 휴리스틱 그래프가 만들어진다
    expect(graph.nodes.length).toBeGreaterThan(1);
  });
});

describe('createSearchOrchestrator (스냅샷 캐시 read-through/write-back)', () => {
  function newOrchestrator() {
    return createSearchOrchestrator({
      cache: newSnapshotCache(),
      reportCache: newReportCache(),
      adapters: [exampleAdapter],
    });
  }

  it('첫 검색은 miss(cached=false), 동일 검색은 hit(cached=true)', async () => {
    const orchestrator = newOrchestrator();

    const first = await orchestrator.search('카카오', undefined, NOW);
    expect(first.cached).toBe(false);

    const second = await orchestrator.search('카카오', undefined, NOW);
    expect(second.cached).toBe(true);
    expect(second.graph).toBe(first.graph); // 동일 스냅샷 재사용
  });

  it('쿼리/타입이 다르면 별도 캐시 키', async () => {
    const orchestrator = newOrchestrator();
    await orchestrator.search('네이버', undefined, NOW);
    const other = await orchestrator.search('네이버', 'company', NOW);
    expect(other.cached).toBe(false);
  });
});

// ── 리포트 2단 캐시(ADR-0011): 스냅샷 30분 vs 리포트 7일 분리 ──
describe('createSearchOrchestrator (리포트 2단 캐시)', () => {
  /** 텍스트 블록 하나를 반환하는 가짜 Anthropic 클라이언트 + create 스파이. */
  function mockAnthropic(text: string) {
    const create = vi.fn(async () => ({
      stop_reason: 'end_turn' as Anthropic.Message['stop_reason'],
      content: [{ type: 'text', text }],
    }));
    const client = { messages: { create } } as unknown as Pick<Anthropic, 'messages'>;
    return { client, create };
  }

  const VALID_REPORT = JSON.stringify({
    summary: '핵심 요약',
    angles: [{ key: 'economy', hook: '훅', report: '경제 관점 본문 리포트', sourceRefs: [0] }],
  });

  /** collect 호출 횟수를 세는 어댑터(데이터 재수집 검증용). */
  function countingAdapter(): { adapter: SourceAdapter; collect: ReturnType<typeof vi.fn> } {
    const collect = vi.fn(exampleAdapter.collect);
    return { adapter: { ...exampleAdapter, collect }, collect };
  }

  // .env에 실제 키가 있어도 테스트는 항상 mock 클라이언트만 사용한다(네트워크 호출 0).
  let originalKey: string | undefined;
  beforeEach(() => {
    originalKey = env.ANTHROPIC_API_KEY;
    env.ANTHROPIC_API_KEY = 'test-key';
  });
  afterEach(() => {
    env.ANTHROPIC_API_KEY = originalKey;
  });

  it('리포트 캐시 미스 시 LLM을 1회 호출하고 결과를 캐시에 저장한다', async () => {
    const reportCache = newReportCache();
    const { client, create } = mockAnthropic(VALID_REPORT);
    const orchestrator = createSearchOrchestrator({
      cache: newSnapshotCache(),
      reportCache,
      adapters: [exampleAdapter],
      analyze: (q, items) => analyzeUsage(q, items, { client }),
    });

    await orchestrator.search('삼성전자', undefined, NOW);

    expect(create).toHaveBeenCalledOnce();
    expect(reportCache.has(searchCacheKey('삼성전자', undefined))).toBe(true);
  });

  it('스냅샷이 만료돼도 리포트는 캐시 재사용 — 데이터는 재수집, LLM은 재호출 안 함', async () => {
    const snapshotCache = newSnapshotCache();
    const reportCache = newReportCache();
    const { adapter, collect } = countingAdapter();
    const { client, create } = mockAnthropic(VALID_REPORT);
    const orchestrator = createSearchOrchestrator({
      cache: snapshotCache,
      reportCache,
      adapters: [adapter],
      analyze: (q, items) => analyzeUsage(q, items, { client }),
    });

    const key = searchCacheKey('현대자동차', undefined);

    await orchestrator.search('현대자동차', undefined, NOW);
    expect(collect).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledOnce();

    // 30분 스냅샷 만료 시뮬레이션 → 다음 검색은 스냅샷 miss
    snapshotCache.delete(key);

    const second = await orchestrator.search('현대자동차', undefined, NOW);
    expect(second.cached).toBe(false); // 스냅샷은 다시 빌드
    expect(collect).toHaveBeenCalledTimes(2); // 데이터는 신선하게 재수집
    expect(create).toHaveBeenCalledOnce(); // 리포트는 7일 캐시 재사용 → LLM 재호출 없음(비용 방어)
  });

  it('스냅샷 적중 시에는 수집도 LLM도 하지 않는다(핫패스)', async () => {
    const { adapter, collect } = countingAdapter();
    const { client, create } = mockAnthropic(VALID_REPORT);
    const orchestrator = createSearchOrchestrator({
      cache: newSnapshotCache(),
      reportCache: newReportCache(),
      adapters: [adapter],
      analyze: (q, items) => analyzeUsage(q, items, { client }),
    });

    await orchestrator.search('쿠팡', undefined, NOW);
    const hit = await orchestrator.search('쿠팡', undefined, NOW);

    expect(hit.cached).toBe(true);
    expect(collect).toHaveBeenCalledTimes(1); // 두 번째는 스냅샷 적중 → 재수집 없음
    expect(create).toHaveBeenCalledOnce(); // LLM도 1회뿐
  });

  // ADR-0014 end-to-end: Layer A 전용 수집은 LLM 미호출 + 7일 리포트 캐시 미적재여야 한다.
  // (report.ts 게이트가 null을 반환 → readThroughReportCache의 `if(report) set` 음성 분기 검증)
  it('Layer A 소스만이면 LLM을 호출하지 않고 7일 리포트 캐시에도 적재하지 않는다(ADR-0014)', async () => {
    const reportCache = newReportCache();
    const { client, create } = mockAnthropic(VALID_REPORT);
    const layerAAdapter: SourceAdapter = { ...exampleAdapter, layer: 'A' };
    const orchestrator = createSearchOrchestrator({
      cache: newSnapshotCache(),
      reportCache,
      adapters: [layerAAdapter],
      analyze: (q, items) => analyzeUsage(q, items, { client }),
    });

    const result = await orchestrator.search('네이버전용', undefined, NOW);

    expect(create).not.toHaveBeenCalled(); // Layer A → LLM 미호출(지출 0)
    expect(reportCache.has(searchCacheKey('네이버전용', undefined))).toBe(false); // null 리포트 미적재
    // 검색은 끊기지 않고 휴리스틱 그래프로 폴백(usage 노드 없음)
    expect(result.graph.nodes.some((n) => n.kind === 'usage')).toBe(false);
    expect(result.graph.nodes.find((n) => n.kind === 'center')?.label).toBe('네이버전용');
  });
});
