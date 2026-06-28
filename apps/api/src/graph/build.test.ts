import { describe, expect, it } from 'vitest';
import { GraphSnapshotSchema } from '@cerebro/shared';
import { normalize } from '../collect/normalize.js';
import { buildGraphFromCollection } from './build.js';
import type { UsageReport } from '../analyze/report.js';

const NOW = '2026-06-25T00:00:00.000Z';

/** 그래프 빌더가 엣지 weight에 쓰는 라운딩(build.ts round2와 동일) — 골격 헬퍼 추출 시 동등성 잠금. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

describe('buildGraphFromCollection', () => {
  it('중심+토픽으로 유효한 그래프를 만든다', () => {
    const items = [
      normalize({ title: '토스 제품', url: 'https://e.com/1', snippet: '토스 제품 기능' }, 'web', 'A', 's1', NOW),
      normalize({ title: '토스 뉴스', url: 'https://e.com/2', snippet: '토스 뉴스 발표' }, 'web', 'A', 's2', NOW),
    ];
    const graph = buildGraphFromCollection('토스', 'company', items, NOW);
    expect(() => GraphSnapshotSchema.parse(graph)).not.toThrow();
    expect(graph.nodes.find((n) => n.kind === 'center')?.label).toBe('토스');
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.edges.every((e) => e.source === 'center')).toBe(true);

    // 중심→가지 엣지 weight = 대상 노드 importance의 round2 (centerEdges 헬퍼 추출 전 잠금).
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const e of graph.edges) {
      expect(e.weight).toBe(round2(byId.get(e.target)!.importance));
    }
  });

  it('검색어 토큰은 토픽에서 제외한다(중심 중복 방지)', () => {
    const items = [
      normalize({ title: '토스 제품', url: 'https://e.com/1', snippet: '토스 제품 기능' }, 'web', 'A', 's1', NOW),
      normalize({ title: '토스 뉴스', url: 'https://e.com/2', snippet: '토스 뉴스 발표' }, 'web', 'A', 's2', NOW),
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
      normalize({ title: '토스 투자 유치', url: 'https://www.yna.co.kr/view/1', snippet: '연합뉴스 보도' }, 'naver', 'A', 's1', NOW),
      normalize({ title: '토스 솔직후기', url: 'https://blog.naver.com/u/1', snippet: '사용 후기' }, 'naver', 'A', 's2', NOW),
      normalize({ title: '토스 유튜브', url: 'https://youtube.com/@toss', snippet: '공식 채널' }, 'naver', 'A', 's3', NOW),
      normalize({ title: '간편결제 개요', url: 'https://ko.wikipedia.org/wiki/간편결제', snippet: '결제 방식' }, 'wikipedia', 'B', 's4', NOW),
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
        'A',
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

describe('buildGraphFromCollection — LLM 활용 관점 그래프 (ADR-0008)', () => {
  const items = [
    normalize({ title: '토스 투자 유치', url: 'https://www.yna.co.kr/view/1', snippet: '투자' }, 'naver', 'A', 's1', NOW),
    normalize({ title: '토스 채용', url: 'https://blog.naver.com/u/1', snippet: '채용' }, 'naver', 'A', 's2', NOW),
  ];

  it('분석이 있으면 중심(요약)+활용 관점 노드 그래프를 만든다', () => {
    const analysis: UsageReport = {
      summary: '토스는 투자·채용을 확대 중이다.',
      angles: [
        { key: 'investment', label: '투자 관점', hook: '호재 가능성', report: '투자 유치는 성장 신호.', sourceIds: ['s1'] },
        { key: 'career', label: '취업·커리어', hook: '채용 확대', report: '구직 기회 증가.', sourceIds: ['s1', 's2'] },
      ],
    };
    const graph = buildGraphFromCollection('토스', 'company', items, NOW, analysis);

    expect(() => GraphSnapshotSchema.parse(graph)).not.toThrow();
    const center = graph.nodes.find((n) => n.kind === 'center');
    expect(center?.report).toBe('토스는 투자·채용을 확대 중이다.');

    const usage = graph.nodes.filter((n) => n.kind === 'usage');
    expect(usage.map((n) => n.id)).toEqual(['usage-investment', 'usage-career']);
    expect(usage.find((n) => n.id === 'usage-investment')?.report).toBe('투자 유치는 성장 신호.');
    expect(usage.find((n) => n.id === 'usage-investment')?.sourceIds).toEqual(['s1']);
    expect(graph.edges.every((e) => e.source === 'center' && e.relation === '활용')).toBe(true);

    // 활용 그래프도 중심→가지 weight = 대상 importance round2 (centerEdges 헬퍼 추출 전 잠금).
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const e of graph.edges) {
      expect(e.weight).toBe(round2(byId.get(e.target)!.importance));
    }
  });

  it('활용 관점이 비면 휴리스틱(카테고리/토픽) 그래프로 폴백한다', () => {
    const analysis: UsageReport = { summary: '요약만 있음', angles: [] };
    const graph = buildGraphFromCollection('토스', 'company', items, NOW, analysis);
    expect(graph.nodes.some((n) => n.kind === 'usage')).toBe(false);
    expect(graph.nodes.some((n) => n.kind === 'center')).toBe(true);
  });
});
