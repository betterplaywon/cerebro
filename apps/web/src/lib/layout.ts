import type { GraphSnapshot } from '@cerebro/shared';

export type Vec3 = [number, number, number];

/** 방사형 레이아웃 튜닝 상수 — 기하 값을 의미있는 이름으로(매직넘버 제거). */
const LAYOUT = {
  /** 중심 → 1차 가지 구 반경 */
  BRANCH_RADIUS: 5.5,
  /** 가지 → 잎 분산 반경 */
  LEAF_RADIUS: 2.4,
  /** 미연결 노드 외곽 링 반경 배수(가지 반경 대비) */
  ORPHAN_RING_FACTOR: 1.7,
  /** y축 압축 비율(구를 보기 좋게 납작하게) */
  Y_COMPRESSION: 0.65,
  /** 방향 벡터용 단위 구 반경 */
  UNIT_RADIUS: 1,
} as const;

/**
 * 결정적 방사형 레이아웃: 중심(원점) → 1차 가지(구면 피보나치) → 잎(부모 주변).
 * 물리 시뮬레이션 없이 안정적인 좌표를 만든다(오버엔지니어링 경계). 추후 force layout으로 교체 가능.
 */
export function layoutGraph(graph: GraphSnapshot): Map<string, Vec3> {
  const positions = new Map<string, Vec3>();

  const childrenOf = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = childrenOf.get(edge.source) ?? [];
    list.push(edge.target);
    childrenOf.set(edge.source, list);
  }

  const center = graph.nodes.find((n) => n.kind === 'center') ?? graph.nodes[0];
  if (!center) return positions;
  positions.set(center.id, [0, 0, 0]);

  const branches = childrenOf.get(center.id) ?? [];

  branches.forEach((branchId, i) => {
    const bp = fibonacciSphere(i, branches.length, LAYOUT.BRANCH_RADIUS);
    positions.set(branchId, bp);

    const leaves = childrenOf.get(branchId) ?? [];
    leaves.forEach((leafId, j) => {
      const dir = fibonacciSphere(j, Math.max(leaves.length, 1), LAYOUT.UNIT_RADIUS);
      positions.set(leafId, [
        bp[0] + dir[0] * LAYOUT.LEAF_RADIUS,
        bp[1] + dir[1] * LAYOUT.LEAF_RADIUS,
        bp[2] + dir[2] * LAYOUT.LEAF_RADIUS,
      ]);
    });
  });

  // 연결되지 않은 노드는 외곽 링에 배치
  graph.nodes.forEach((node, i) => {
    if (!positions.has(node.id)) {
      const radius = LAYOUT.BRANCH_RADIUS * LAYOUT.ORPHAN_RING_FACTOR;
      positions.set(node.id, fibonacciSphere(i, graph.nodes.length, radius));
    }
  });

  return positions;
}

/**
 * 배치된 노드들을 모두 감싸는 바운딩 구의 반경(원점 기준 최대 거리).
 * 카메라가 그래프 전체를 프레이밍할 때 기준값으로 쓴다. 빈 그래프는 1을 반환(0 division 방지).
 */
export function graphRadius(positions: Map<string, Vec3>): number {
  let max = 0;
  for (const [, p] of positions) {
    const d = Math.hypot(p[0], p[1], p[2]);
    if (d > max) max = d;
  }
  return Math.max(max, 1);
}

/** 구면에 점을 고르게 분포(황금각). y축은 약간 압축해 보기 좋게. */
function fibonacciSphere(index: number, count: number, radius: number): Vec3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = count <= 1 ? 0 : 1 - (index / (count - 1)) * 2;
  const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  return [
    Math.cos(theta) * ringRadius * radius,
    y * radius * LAYOUT.Y_COMPRESSION,
    Math.sin(theta) * ringRadius * radius,
  ];
}
