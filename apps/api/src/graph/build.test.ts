import { describe, expect, it } from 'vitest';
import { GraphSnapshotSchema } from '@cerebro/shared';
import { normalize } from '../collect/normalize.js';
import { buildGraphFromCollection } from './build.js';

const NOW = '2026-06-25T00:00:00.000Z';

describe('buildGraphFromCollection', () => {
  it('중심+토픽으로 유효한 그래프를 만든다', () => {
    const items = [
      normalize({ title: '토스 제품', url: 'https://e.com/1', snippet: '토스 제품 기능' }, 'web', 's1', NOW),
      normalize({ title: '토스 뉴스', url: 'https://e.com/2', snippet: '토스 뉴스 발표' }, 'web', 's2', NOW),
    ];
    const graph = buildGraphFromCollection('토스', 'company', items, NOW);
    expect(() => GraphSnapshotSchema.parse(graph)).not.toThrow();
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('토스');
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.edges.every((e) => e.source === 'center')).toBe(true);
  });

  it('검색어 토큰은 토픽에서 제외한다(중심 중복 방지)', () => {
    const items = [
      normalize({ title: '토스 제품', url: 'https://e.com/1', snippet: '토스 제품 기능' }, 'web', 's1', NOW),
      normalize({ title: '토스 뉴스', url: 'https://e.com/2', snippet: '토스 뉴스 발표' }, 'web', 's2', NOW),
    ];
    const graph = buildGraphFromCollection('토스', 'company', items, NOW);
    const topicLabels = graph.nodes.filter((n) => n.kind === 'concept').map((n) => n.label);
    expect(topicLabels).not.toContain('토스');
    expect(topicLabels.length).toBeGreaterThan(0);
  });

  it('빈 수집이면 중심 노드만 둔다', () => {
    const graph = buildGraphFromCollection('빈검색', undefined, [], NOW);
    expect(() => GraphSnapshotSchema.parse(graph)).not.toThrow();
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]?.kind).toBe('center');
  });
});
