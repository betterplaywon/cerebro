import type { GraphSnapshot } from '@cerebro/shared';

export type Vec3 = [number, number, number];

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
  const branchRadius = 5.5;
  const leafRadius = 2.4;

  branches.forEach((branchId, i) => {
    const bp = fibonacciSphere(i, branches.length, branchRadius);
    positions.set(branchId, bp);

    const leaves = childrenOf.get(branchId) ?? [];
    leaves.forEach((leafId, j) => {
      const dir = fibonacciSphere(j, Math.max(leaves.length, 1), 1);
      positions.set(leafId, [
        bp[0] + dir[0] * leafRadius,
        bp[1] + dir[1] * leafRadius,
        bp[2] + dir[2] * leafRadius,
      ]);
    });
  });

  // 연결되지 않은 노드는 외곽 링에 배치
  graph.nodes.forEach((node, i) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, fibonacciSphere(i, graph.nodes.length, branchRadius * 1.7));
    }
  });

  return positions;
}

/** 구면에 점을 고르게 분포(황금각). y축은 약간 압축해 보기 좋게. */
function fibonacciSphere(index: number, count: number, radius: number): Vec3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = count <= 1 ? 0 : 1 - (index / (count - 1)) * 2;
  const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  return [Math.cos(theta) * ringRadius * radius, y * radius * 0.65, Math.sin(theta) * ringRadius * radius];
}
