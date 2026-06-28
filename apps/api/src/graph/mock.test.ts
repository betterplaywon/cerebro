import { describe, expect, it } from 'vitest';
import { GraphSnapshotSchema, NODE_KIND_LABELS } from '@cerebro/shared';
import { buildMockGraph } from './mock.js';

/**
 * 특성화 잠금: buildMockGraph는 직접 테스트가 없어, 골격 헬퍼 추출(ADR 그래프 dedup) 시
 * 출력 동등성을 보장할 안전망이 필요하다. 노드 id·라벨·kind·엣지·weight·subject를 정확히 잠근다.
 * (generatedAt/collectedAt은 new Date() 기반이라 값이 아닌 구조만 검증.)
 */
describe('buildMockGraph (결정적 목업 — 특성화 잠금)', () => {
  const g = buildMockGraph('토스', 'company');

  it('유효한 GraphSnapshot이다', () => {
    expect(() => GraphSnapshotSchema.parse(g)).not.toThrow();
  });

  it('subject를 검색어/타입으로 만든다', () => {
    expect(g.subject).toEqual({ id: 'subject-1', query: '토스', type: 'company', displayName: '토스' });
  });

  it('type 미지정 시 unknown으로 기본한다', () => {
    expect(buildMockGraph('토스').subject.type).toBe('unknown');
  });

  it('노드 id가 정확히 보존된다(중심+가지+잎)', () => {
    expect(g.nodes.map((n) => n.id)).toEqual([
      'center',
      'n-product',
      'n-news',
      'n-reputation',
      'n-channel',
      'n-concept',
      'l-product-1',
      'l-news-1',
      'l-reputation-1',
    ]);
  });

  it('중심 노드 형태를 보존한다', () => {
    const c = g.nodes.find((n) => n.id === 'center')!;
    expect(c).toMatchObject({
      label: '토스',
      kind: 'center',
      importance: 1,
      confidence: 0.9,
      sourceIds: ['s-wiki'],
    });
  });

  it('가지 라벨은 NODE_KIND_LABELS, concept만 목업 전용 표시명을 유지한다', () => {
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    expect(byId.get('n-product')!.label).toBe(NODE_KIND_LABELS.product);
    expect(byId.get('n-news')!.label).toBe(NODE_KIND_LABELS.news);
    expect(byId.get('n-reputation')!.label).toBe(NODE_KIND_LABELS.reputation);
    expect(byId.get('n-channel')!.label).toBe(NODE_KIND_LABELS.channel);
    // 의도적 보존: concept는 정식 라벨('관련 개념')이 아닌 목업 전용 '관련 키워드'.
    expect(byId.get('n-concept')!.label).toBe('관련 키워드');
  });

  it('중심→가지 엣지(관련) + 가지→잎 엣지(포함)를 정확한 weight로 만든다', () => {
    expect(g.edges).toEqual([
      { id: 'e-center-n-product', source: 'center', target: 'n-product', relation: '관련', weight: 0.8 },
      { id: 'e-center-n-news', source: 'center', target: 'n-news', relation: '관련', weight: 0.75 },
      { id: 'e-center-n-reputation', source: 'center', target: 'n-reputation', relation: '관련', weight: 0.7 },
      { id: 'e-center-n-channel', source: 'center', target: 'n-channel', relation: '관련', weight: 0.65 },
      { id: 'e-center-n-concept', source: 'center', target: 'n-concept', relation: '관련', weight: 0.6 },
      { id: 'e-product-leaf', source: 'n-product', target: 'l-product-1', relation: '포함', weight: 0.5 },
      { id: 'e-news-leaf', source: 'n-news', target: 'l-news-1', relation: '포함', weight: 0.45 },
      { id: 'e-reputation-leaf', source: 'n-reputation', target: 'l-reputation-1', relation: '포함', weight: 0.42 },
    ]);
  });

  it('출처 4건을 정확한 id/type으로 만든다', () => {
    expect(g.sources.map((s) => s.id)).toEqual(['s-naver', 's-wiki', 's-store', 's-blog']);
    expect(g.sources.map((s) => s.type)).toEqual(['naver', 'wikipedia', 'appstore', 'blog']);
  });
});
