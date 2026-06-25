import {
  GRAPH_LIMITS,
  type GraphEdge,
  type GraphNode,
  type GraphSnapshot,
  type Source,
  type SubjectType,
} from '@cerebro/shared';
import { tokenize, type NormalizedItem } from '../collect/normalize.js';
import { extractTopics } from '../collect/score.js';

/**
 * 수집·정규화된 항목으로 중심-가지 그래프를 만든다.
 * 중심 = 검색 주제, 가지 = 교차 출처 상위 토픽(concept 노드).
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

  const maxTopics = Math.max(0, Math.min(GRAPH_LIMITS.MAX_NODES - 1, 8));
  // 검색어 자체 토큰은 중심과 중복되므로 토픽에서 제외
  const queryTokens = new Set(tokenize(query));
  const topics = extractTopics(items, maxTopics + 4)
    .filter((t) => !queryTokens.has(t.token))
    .slice(0, maxTopics);

  const topicNodes: GraphNode[] = topics.map((t, i) => ({
    id: `topic-${i}`,
    label: t.token,
    kind: 'concept',
    importance: round2(0.4 + t.weight * 0.5),
    confidence: 0.5,
    sourceIds: t.sourceIds,
  }));

  const edges: GraphEdge[] = topicNodes.map((node, i) => ({
    id: `e-center-${node.id}`,
    source: 'center',
    target: node.id,
    relation: '관련',
    weight: round2(topics[i]?.weight ?? 0.5),
  }));

  return {
    subject: { id: 'subject-1', query, type: subjectType ?? 'unknown', displayName: query },
    nodes: [center, ...topicNodes],
    edges,
    sources,
    generatedAt,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
