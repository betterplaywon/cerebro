import {
  GRAPH_LIMITS,
  type GraphEdge,
  type GraphNode,
  type GraphSnapshot,
  type NodeKind,
  type Source,
  type SubjectType,
} from '@cerebro/shared';
import { tokenize, type NormalizedItem } from '../collect/normalize.js';
import { extractTopics } from '../collect/score.js';
import { classifySource } from './category-rules.js';

/** 색이 입혀지는 카테고리 가지(중심·concept·attribute 제외). emit 순서 = 표시 우선순위. */
const CATEGORY_KINDS = ['product', 'news', 'reputation', 'channel', 'person'] as const;
type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** 카테고리 한국어 라벨(web NODE_KIND_LABELS와 정합; 3번째 중복 시 shared로 승격). */
const CATEGORY_LABELS: Record<CategoryKind, string> = {
  product: '제품·서비스',
  news: '뉴스·이슈',
  reputation: '평판·리뷰',
  channel: '채널·플랫폼',
  person: '인물',
};

/** 가독성 예산: 중심 외 가지(카테고리+concept) 총합 상한. */
const MAX_BRANCHES = 10;
/** 카테고리 노드를 뒷받침할 대표 출처 최대 개수(출처 투명성). */
const MAX_REPRESENTATIVES = 3;

/**
 * 수집·정규화된 항목으로 중심-가지 그래프를 만든다.
 * 가지 = (1)출처 출처지 기반 **카테고리 노드**(제품/뉴스/평판/채널/인물) + (2)교차 출처 상위 **키워드 토픽**(concept).
 * 두 신호는 직교한다(어떤 출처인가 vs 무슨 키워드인가) — 한 출처가 카테고리와 토픽 양쪽을 뒷받침할 수 있다.
 */
export function buildGraphFromCollection(
  query: string,
  subjectType: SubjectType | undefined,
  items: NormalizedItem[],
  generatedAt: string,
): GraphSnapshot {
  const sources: Source[] = items.map((i) => i.source);

  const center: GraphNode = {
    id: 'center',
    label: query,
    kind: 'center',
    summary: `'${query}'에 대한 공개정보 마인드맵`,
    importance: 1,
    confidence: 0.9,
    sourceIds: sources.slice(0, 1).map((s) => s.id),
  };

  const categoryNodes = buildCategoryNodes(query, subjectType, items);
  const conceptBudget = clamp(MAX_BRANCHES - categoryNodes.length, 2, 8);
  const conceptNodes = buildConceptNodes(query, items, conceptBudget);

  const branchNodes = [...categoryNodes, ...conceptNodes];
  const edges: GraphEdge[] = branchNodes.map((node) => ({
    id: `e-center-${node.id}`,
    source: 'center',
    target: node.id,
    relation: '관련',
    weight: round2(node.importance),
  }));

  return {
    subject: { id: 'subject-1', query, type: subjectType ?? 'unknown', displayName: query },
    nodes: [center, ...branchNodes],
    edges,
    sources,
    generatedAt,
  };
}

/** 출처를 카테고리로 분류해 비어있지 않은 카테고리마다 가지 노드 1개를 만든다. */
function buildCategoryNodes(
  query: string,
  subjectType: SubjectType | undefined,
  items: NormalizedItem[],
): GraphNode[] {
  const total = items.length;
  if (total === 0) return [];

  const byCategory = new Map<CategoryKind, NormalizedItem[]>();
  for (const item of items) {
    const kind = classifySource(item.source, subjectType);
    if (!isCategoryKind(kind)) continue; // concept/attribute는 토픽 단계가 담당
    const members = byCategory.get(kind) ?? [];
    members.push(item);
    byCategory.set(kind, members);
  }

  const nodes: GraphNode[] = [];
  for (const kind of CATEGORY_KINDS) {
    const members = byCategory.get(kind);
    if (!members || members.length === 0) continue;
    const reps = [...members]
      .sort((a, b) => b.source.confidence - a.source.confidence || recency(b) - recency(a))
      .slice(0, MAX_REPRESENTATIVES);
    nodes.push({
      id: `cat-${kind}`,
      label: CATEGORY_LABELS[kind],
      kind,
      summary: `'${query}' 관련 ${CATEGORY_LABELS[kind]}`,
      importance: round2(clamp(0.5 + 0.4 * (members.length / total), 0.5, 0.9)),
      confidence: round2(mean(members.map((m) => m.source.confidence))),
      sourceIds: reps.map((r) => r.source.id),
    });
  }
  return nodes;
}

/** 교차 출처 빈도 상위 키워드를 concept 노드로 만든다(검색어 자체 토큰은 중심과 중복이라 제외). */
function buildConceptNodes(query: string, items: NormalizedItem[], budget: number): GraphNode[] {
  const cap = Math.max(0, Math.min(GRAPH_LIMITS.MAX_NODES - 1, budget));
  const queryTokens = new Set(tokenize(query));
  const topics = extractTopics(items, cap + 4)
    .filter((t) => !queryTokens.has(t.token))
    .slice(0, cap);

  return topics.map((t, i) => ({
    id: `topic-${i}`,
    label: t.token,
    kind: 'concept' as NodeKind,
    importance: round2(0.4 + t.weight * 0.5),
    confidence: 0.5,
    sourceIds: t.sourceIds,
  }));
}

function isCategoryKind(kind: NodeKind): kind is CategoryKind {
  return (CATEGORY_KINDS as readonly NodeKind[]).includes(kind);
}

/** 게시일 기준 최신성 점수(없으면 0). 대표 출처 정렬용. */
function recency(item: NormalizedItem): number {
  const published = item.source.publishedAt;
  if (!published) return 0;
  const t = Date.parse(published);
  return Number.isNaN(t) ? 0 : t;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
