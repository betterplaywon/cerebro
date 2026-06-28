import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { GraphSnapshot } from '@cerebro/shared';
import { env } from '../env.js';
import { createTTLCache } from '../lib/cache.js';
import { exampleAdapter } from '../sources/example.js';
import { buildMockGraph } from '../graph/mock.js';
import { analyzeUsage, type UsageReport } from '../analyze/report.js';
import {
  createSearchOrchestrator,
  searchCacheKey,
  type SearchOrchestrator,
} from './search-orchestrator.js';
import { PREWARM_SEEDS, prewarm } from './prewarm.js';

const noopLogger = () => ({ warn: vi.fn(), error: vi.fn() });
const immediateSleep = () => Promise.resolve();

describe('PREWARM_SEEDS', () => {
  it('8~15개 규모의 시드를 정의한다(과도한 기동 비용 방지)', () => {
    expect(PREWARM_SEEDS.length).toBeGreaterThanOrEqual(8);
    expect(PREWARM_SEEDS.length).toBeLessThanOrEqual(15);
  });
});

describe('prewarm', () => {
  it('시드를 순차 검색하고 사이마다 한 번씩 대기한다', async () => {
    const sleep = vi.fn(immediateSleep);
    const search = vi.fn(() =>
      Promise.resolve({ graph: buildMockGraph('x', undefined), cached: false }),
    );
    const orchestrator: SearchOrchestrator = { search };

    await prewarm(orchestrator, noopLogger(), { seeds: ['a', 'b', 'c'], sleep });

    expect(search).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2); // 시드 사이에만(마지막 뒤엔 대기 없음)
  });

  it('한 시드 실패는 흡수하고 나머지를 계속한다(best-effort, 크래시 없음)', async () => {
    const failing: SearchOrchestrator = { search: () => Promise.reject(new Error('boom')) };
    const logger = noopLogger();

    await expect(
      prewarm(failing, logger, { seeds: ['a', 'b'], sleep: immediateSleep }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  describe('두 캐시를 채운다(스냅샷 + 리포트)', () => {
    let originalKey: string | undefined;
    beforeEach(() => {
      originalKey = env.ANTHROPIC_API_KEY;
      env.ANTHROPIC_API_KEY = 'test-key';
    });
    afterEach(() => {
      env.ANTHROPIC_API_KEY = originalKey;
    });

    it('프리웜 후 스냅샷·리포트 캐시에 시드 항목이 들어간다', async () => {
      const create = vi.fn(async () => ({
        stop_reason: 'end_turn' as Anthropic.Message['stop_reason'],
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: '요약',
              angles: [{ label: '경제·산업', hook: '훅', report: '본문', sourceRefs: [0] }],
            }),
          },
        ],
      }));
      const client = { messages: { create } } as unknown as Pick<Anthropic, 'messages'>;

      const snapshotCache = createTTLCache<GraphSnapshot>({ ttlMs: 60_000 });
      const reportCache = createTTLCache<UsageReport>({ ttlMs: 60_000 });
      const orchestrator = createSearchOrchestrator({
        cache: snapshotCache,
        reportCache,
        adapters: [exampleAdapter],
        analyze: (q, items) => analyzeUsage(q, items, { client }),
      });

      await prewarm(orchestrator, noopLogger(), { seeds: ['삼성전자', '카카오'], sleep: immediateSleep });

      for (const seed of ['삼성전자', '카카오']) {
        const key = searchCacheKey(seed, undefined);
        expect(snapshotCache.has(key)).toBe(true);
        expect(reportCache.has(key)).toBe(true);
      }
    });
  });
});
