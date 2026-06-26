import type { GraphSnapshot, GraphNode, GraphEdge, Source, SubjectType } from '@cerebro/shared';

/**
 * MVP 스텁: 실제 수집(SourceAdapter) 전까지 프론트 개발/검증을 위한 결정적 목업 그래프.
 * 실제 데이터 수집은 추후 apps/api/src/sources/* 어댑터로 대체된다. (docs/DATA-SOURCING.md)
 */
export function buildMockGraph(query: string, type: SubjectType = 'unknown'): GraphSnapshot {
  const now = new Date().toISOString();
  const mkSource = (id: string, title: string, t: Source['type'], confidence: number): Source => ({
    id,
    type: t,
    title,
    url: `https://example.com/${encodeURIComponent(query)}/${id}`,
    snippet: `${query} 관련 ${title} (목업 데이터)`,
    collectedAt: now,
    confidence,
  });

  const sources: Source[] = [
    mkSource('s-naver', '네이버 검색 결과', 'naver', 0.7),
    mkSource('s-wiki', '위키백과 개요', 'wikipedia', 0.85),
    mkSource('s-store', '앱스토어 정보', 'appstore', 0.6),
    mkSource('s-blog', '블로그 리뷰', 'blog', 0.5),
  ];

  const center: GraphNode = {
    id: 'center',
    label: query,
    kind: 'center',
    summary: `'${query}'에 대한 공개정보를 중심-가지 구조로 정리한 결과입니다. (현재는 목업)`,
    importance: 1,
    confidence: 0.9,
    sourceIds: ['s-wiki'],
  };

  const branches: GraphNode[] = [
    { id: 'n-product', label: '제품·서비스', kind: 'product', importance: 0.8, confidence: 0.7, sourceIds: ['s-store'], summary: '대표 제품/서비스' },
    { id: 'n-news', label: '뉴스·이슈', kind: 'news', importance: 0.75, confidence: 0.65, sourceIds: ['s-naver'], summary: '최근 언급/이슈' },
    { id: 'n-reputation', label: '평판·리뷰', kind: 'reputation', importance: 0.7, confidence: 0.55, sourceIds: ['s-blog'], summary: '사용자 평판' },
    { id: 'n-channel', label: '채널·플랫폼', kind: 'channel', importance: 0.65, confidence: 0.6, sourceIds: ['s-store'], summary: '공식 채널/플랫폼' },
    { id: 'n-concept', label: '관련 키워드', kind: 'concept', importance: 0.6, confidence: 0.5, sourceIds: [], summary: '연관 개념' },
  ];

  const leaves: GraphNode[] = [
    { id: 'l-product-1', label: '주요 기능', kind: 'attribute', importance: 0.45, confidence: 0.5, sourceIds: ['s-store'] },
    { id: 'l-news-1', label: '최근 발표', kind: 'attribute', importance: 0.4, confidence: 0.45, sourceIds: ['s-naver'] },
    { id: 'l-reputation-1', label: '긍정 리뷰', kind: 'attribute', importance: 0.38, confidence: 0.4, sourceIds: ['s-blog'] },
  ];

  const nodes: GraphNode[] = [center, ...branches, ...leaves];

  const edges: GraphEdge[] = [
    ...branches.map(
      (b): GraphEdge => ({
        id: `e-center-${b.id}`,
        source: center.id,
        target: b.id,
        relation: '관련',
        weight: b.importance,
      }),
    ),
    { id: 'e-product-leaf', source: 'n-product', target: 'l-product-1', relation: '포함', weight: 0.5 },
    { id: 'e-news-leaf', source: 'n-news', target: 'l-news-1', relation: '포함', weight: 0.45 },
    { id: 'e-reputation-leaf', source: 'n-reputation', target: 'l-reputation-1', relation: '포함', weight: 0.42 },
  ];

  return {
    subject: { id: 'subject-1', query, type, displayName: query },
    nodes,
    edges,
    sources,
    generatedAt: now,
  };
}
