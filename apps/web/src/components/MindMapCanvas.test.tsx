import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { GraphNode, GraphSnapshot, NodeKind } from '@cerebro/shared';
import { MindMapScene } from './MindMapCanvas';

/**
 * R3F 시각/상호작용 특성화 테스트(회귀 가드).
 * 무거운 후처리·드라이 컴포넌트는 WebGL/DOM을 요구하므로 test-renderer에서 스텁한다.
 * Html 타일은 DOM 포털이라 씬에 안 잡히므로, 카운트 가능한 마커 group으로 대체한다.
 */
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: () => null,
  Bloom: () => null,
  Vignette: () => null,
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ position }: { position: [number, number, number] }) => (
    <group position={position} userData={{ tile: true }} />
  ),
  Line: () => null,
  OrbitControls: () => null,
}));

const node = (id: string, kind: NodeKind, importance: number): GraphNode => ({
  id,
  label: id,
  kind,
  importance,
  confidence: 0.7,
  sourceIds: [],
});

function mockGraph(): GraphSnapshot {
  return {
    subject: { id: 'subject-1', query: 'q', type: 'unknown', displayName: 'q' },
    nodes: [
      node('center', 'center', 1),
      node('cat-product', 'product', 0.8),
      node('cat-news', 'news', 0.7),
      node('topic-0', 'concept', 0.5),
    ],
    edges: [
      { id: 'e1', source: 'center', target: 'cat-product', relation: '관련', weight: 0.8 },
      { id: 'e2', source: 'center', target: 'cat-news', relation: '관련', weight: 0.7 },
      { id: 'e3', source: 'center', target: 'topic-0', relation: '관련', weight: 0.5 },
    ],
    sources: [],
    generatedAt: new Date().toISOString(),
  };
}

interface Counts {
  glow: number;
  hit: number;
  tiles: number;
}

function countLayers(scene: { instance: import('three').Object3D }): Counts {
  const counts: Counts = { glow: 0, hit: 0, tiles: 0 };
  scene.instance.traverse((o) => {
    const mesh = o as import('three').Mesh;
    if (o.type === 'Mesh') {
      const matType = (mesh.material as { type?: string } | undefined)?.type;
      if (matType === 'MeshStandardMaterial') counts.glow += 1;
      else if (matType === 'MeshBasicMaterial') counts.hit += 1;
    }
    if (o.userData?.tile === true) counts.tiles += 1;
  });
  return counts;
}

describe('MindMapCanvas', () => {
  it('위치가 있는 모든 노드마다 글로우 코어·히트구·타일을 정확히 1개씩 만든다', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MindMapScene graph={mockGraph()} selectedId={null} onSelect={vi.fn()} />,
    );
    const { glow, hit, tiles } = countLayers(renderer.scene);
    expect(glow).toBe(4); // NodeGlow = meshStandardMaterial
    expect(hit).toBe(4); // NodeHitTarget = meshBasicMaterial
    expect(tiles).toBe(4); // NodeTile = Html(스텁 마커 group)
  });

  it('히트구 클릭 시 해당 노드로 onSelect를 호출한다', async () => {
    const onSelect = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <MindMapScene graph={mockGraph()} selectedId={null} onSelect={onSelect} />,
    );
    const hits = renderer.scene.findAll(
      (n) => (n.instance as { material?: { type?: string } }).material?.type === 'MeshBasicMaterial',
    );
    expect(hits).toHaveLength(4);
    const [target] = hits;
    if (!target) throw new Error('히트구를 찾지 못했습니다');
    await renderer.fireEvent(target, 'click', { stopPropagation: () => {} });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: expect.any(String) });
  });
});
