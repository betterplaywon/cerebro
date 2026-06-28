import type { GraphEdge, GraphNode, GraphSnapshot, SubjectType } from '@cerebro/shared';

/**
 * 중심-가지 그래프의 **불변 골격** 공유 헬퍼.
 * buildHeuristicGraph·buildUsageGraph(build.ts)·buildMockGraph(mock.ts) 세 전략이
 * subject 리터럴 / center 노드 / center→가지 엣지 팬아웃을 line-for-line 복붙하던 것을 단일화한다
 * (코딩표준 rule-of-3 = 3번째 중복에서 추상화). 전략별 차이(요약·리포트·관계 라벨)만 인자로 주입한다.
 */

const SUBJECT_ID = 'subject-1';
const CENTER_ID = 'center';
/** 중심 노드는 정의상 최상위 중요도이며 그래프 신뢰의 기준점이다(전 전략 공통 상수). */
const CENTER_IMPORTANCE = 1;
const CENTER_CONFIDENCE = 0.9;

/** 검색 주체(중심) 메타. type 미지정 시 'unknown'으로 기본한다. */
export function buildSubject(
  query: string,
  subjectType: SubjectType | undefined,
): GraphSnapshot['subject'] {
  return { id: SUBJECT_ID, query, type: subjectType ?? 'unknown', displayName: query };
}

interface CenterNodeInput {
  query: string;
  /** 중심 노드 한 줄 요약. */
  summary: string;
  /** 상세 리포트 본문(있을 때만 — usage 그래프). 없으면 키를 생략한다. */
  report?: string;
  sourceIds: string[];
}

/** 중심 노드. id·kind·importance·confidence는 전 전략 고정, 나머지는 주입한다. */
export function buildCenterNode({ query, summary, report, sourceIds }: CenterNodeInput): GraphNode {
  const node: GraphNode = {
    id: CENTER_ID,
    label: query,
    kind: 'center',
    summary,
    importance: CENTER_IMPORTANCE,
    confidence: CENTER_CONFIDENCE,
    sourceIds,
  };
  // report는 옵셔널 — 휴리스틱·목업 중심엔 키 자체가 없도록 정의 시에만 추가(출력 동등성 보존).
  if (report !== undefined) node.report = report;
  return node;
}

/** 중심→가지 엣지 팬아웃. weight = 가지 importance의 round2. relation만 전략별로 다르다. */
export function centerEdges(branchNodes: GraphNode[], relation: string): GraphEdge[] {
  return branchNodes.map((node) => ({
    id: `e-${CENTER_ID}-${node.id}`,
    source: CENTER_ID,
    target: node.id,
    relation,
    weight: round2(node.importance),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
