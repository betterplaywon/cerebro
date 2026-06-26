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

  it('출처 출처지로 카테고리 가지 노드를 만든다(뉴스·평판·채널)', () => {
    const items = [
      normalize({ title: '토스 투자 유치', url: 'https://www.yna.co.kr/view/1', snippet: '연합뉴스 보도' }, 'naver', 's1', NOW),
      normalize({ title: '토스 솔직후기', url: 'https://blog.naver.com/u/1', snippet: '사용 후기' }, 'naver', 's2', NOW),
      normalize({ title: '토스 유튜브', url: 'https://youtube.com/@toss', snippet: '공식 채널' }, 'naver', 's3', NOW),
      normalize({ title: '간편결제 개요', url: 'https://ko.wikipedia.org/wiki/간편결제', snippet: '결제 방식' }, 'wikipedia', 's4', NOW),
    ];
    const graph = buildGraphFromCollection('토스', 'company', items, NOW);
    const kinds = new Set(graph.nodes.map((n) => n.kind));
    expect(kinds.has('news')).toBe(true);
    expect(kinds.has('reputation')).toBe(true);
    expect(kinds.has('channel')).toBe(true);
    // 카테고리 노드 id 규칙 + 출처 연결 보존
    const news = graph.nodes.find((n) => n.id === 'cat-news');
    expect(news?.sourceIds).toContain('s1');
    // 모든 가지는 중심에서 출발
    expect(graph.edges.every((e) => e.source === 'center')).toBe(true);
  });

  it('가지 총합은 가독성 예산(MAX_BRANCHES=10) 이내', () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      normalize(
        { title: `토스 뉴스 ${i} 키워드${i}`, url: `https://www.yna.co.kr/view/${i}`, snippet: '보도' },
        'naver',
        `s${i}`,
        NOW,
      ),
    );
    const graph = buildGraphFromCollection('토스', 'company', items, NOW);
    const branches = graph.nodes.filter((n) => n.kind !== 'center');
    expect(branches.length).toBeLessThanOrEqual(10);
    expect(() => GraphSnapshotSchema.parse(graph)).not.toThrow();
  });
});
