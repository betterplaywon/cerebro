import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Vector3 } from 'three';
import type { GraphNode, GraphSnapshot, NodeKind } from '@cerebro/shared';
import { layoutGraph, type Vec3 } from '../lib/layout';
import { NODE_COLORS } from '../lib/colors';
import { CategoryIcon } from './CategoryIcon';

/** 3D 씬 시각 튜닝 상수 — 매직넘버를 한곳에 모아 의미를 드러내고 튜닝을 쉽게 한다. */
const SCENE = {
  camera: { position: [0, 0, 15] as [number, number, number], fov: 55 },
  dpr: [1, 2] as [number, number],
  lights: {
    ambient: 0.5,
    key: { position: [10, 10, 10] as [number, number, number], intensity: 1 },
    rim: { position: [-10, -6, -8] as [number, number, number], intensity: 0.45, color: '#3a6bff' },
  },
  glow: { centerRadius: 0.42, branchRadius: 0.18, centerEmissive: 1.7, branchEmissive: 1.15 },
  tile: { distanceFactor: 12, centerIcon: 20, branchIcon: 16 },
  edge: { color: '#3ac8f5', width: 1.3, opacity: 0.45 },
  focus: { lerp: 0.12, settleDistance: 0.04 },
  bloom: { intensity: 0.55, luminanceThreshold: 0.32, luminanceSmoothing: 0.9 },
  vignette: { offset: 0.3, darkness: 0.5 },
};

/** 노드 종류별 타일 변형 클래스(중첩 삼항 대신 매핑). 미지정 종류는 기본 타일. */
const TILE_VARIANT_CLASS: Partial<Record<NodeKind, string>> = {
  center: ' node-tile--center',
  concept: ' node-tile--concept',
};

interface MindMapCanvasProps {
  graph: GraphSnapshot;
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

interface NodeViewProps {
  node: GraphNode;
  position: Vec3;
  selected: boolean;
  onSelect: (node: GraphNode) => void;
}

/** 노드 위치의 작은 발광 코어 — Bloom이 번지게 해 글래스 타일 뒤로 글로우 헤일로를 만든다(상호작용 없음). */
function NodeGlow({ node, position }: { node: GraphNode; position: Vec3 }) {
  const color = NODE_COLORS[node.kind];
  const isCenter = node.kind === 'center';
  return (
    <mesh position={position}>
      <sphereGeometry args={[isCenter ? SCENE.glow.centerRadius : SCENE.glow.branchRadius, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isCenter ? SCENE.glow.centerEmissive : SCENE.glow.branchEmissive}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

/** 노드 = 글래스 아이콘 타일(Html). 카테고리/중심은 아이콘+라벨, concept는 키워드 태그. 클릭=선택. */
function NodeTile({ node, position, selected, onSelect }: NodeViewProps) {
  const isCenter = node.kind === 'center';
  const isConcept = node.kind === 'concept';
  const variant = TILE_VARIANT_CLASS[node.kind] ?? '';
  const selectedClass = selected ? ' is-selected' : '';
  return (
    <Html
      position={position}
      center
      distanceFactor={SCENE.tile.distanceFactor}
      zIndexRange={[0, 0]}
      wrapperClass="node-tile-wrap"
    >
      <button
        type="button"
        className={`node-tile${variant}${selectedClass}`}
        style={{ '--node-color': NODE_COLORS[node.kind] } as CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {!isConcept && (
          <span className="node-tile__icon">
            <CategoryIcon kind={node.kind} size={isCenter ? SCENE.tile.centerIcon : SCENE.tile.branchIcon} />
          </span>
        )}
        <span className="node-tile__label">{node.label}</span>
      </button>
    </Html>
  );
}

interface OrbitLike {
  target: Vector3;
  update: () => void;
}

/** 노드 선택 시 OrbitControls의 회전 중심(target)을 그 노드로 부드럽게 이동 → 클릭한 노드 기준 공전.
 *  정착하면 멈춰 사용자 팬을 방해하지 않는다(프레임당 lerp 1회, 경량). */
function FocusController({ target }: { target: Vec3 | null }) {
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const dest = useMemo(() => (target ? new Vector3(target[0], target[1], target[2]) : null), [target]);
  const settled = useRef(false);
  useEffect(() => {
    settled.current = false;
  }, [dest]);
  useFrame(() => {
    if (!controls || !dest || settled.current) return;
    controls.target.lerp(dest, SCENE.focus.lerp);
    controls.update();
    if (controls.target.distanceTo(dest) < SCENE.focus.settleDistance) settled.current = true;
  });
  return null;
}

/** 3D 마인드맵: 글로우 코어 + 글래스 아이콘 타일 + 글로우 가지 + 절제된 Bloom. 클릭 시 해당 노드로 포커스. */
export function MindMapCanvas({ graph, selectedId, onSelect }: MindMapCanvasProps) {
  const positions = useMemo(() => layoutGraph(graph), [graph]);

  const edgeLines = useMemo(() => {
    return graph.edges
      .map((edge) => {
        const a = positions.get(edge.source);
        const b = positions.get(edge.target);
        return a && b ? { id: edge.id, points: [a, b] as [Vec3, Vec3] } : null;
      })
      .filter((e): e is { id: string; points: [Vec3, Vec3] } => e !== null);
  }, [graph, positions]);

  const selectedPos = selectedId ? (positions.get(selectedId) ?? null) : null;

  return (
    <Canvas camera={{ position: SCENE.camera.position, fov: SCENE.camera.fov }} dpr={SCENE.dpr} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={SCENE.lights.ambient} />
      <pointLight position={SCENE.lights.key.position} intensity={SCENE.lights.key.intensity} />
      <pointLight position={SCENE.lights.rim.position} intensity={SCENE.lights.rim.intensity} color={SCENE.lights.rim.color} />

      {edgeLines.map((edge) => (
        <Line
          key={edge.id}
          points={edge.points}
          color={SCENE.edge.color}
          lineWidth={SCENE.edge.width}
          transparent
          opacity={SCENE.edge.opacity}
        />
      ))}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? <NodeGlow key={`glow-${node.id}`} node={node} position={position} /> : null;
      })}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? (
          <NodeTile
            key={`tile-${node.id}`}
            node={node}
            position={position}
            selected={node.id === selectedId}
            onSelect={onSelect}
          />
        ) : null;
      })}

      <OrbitControls makeDefault enablePan enableZoom enableRotate />
      <FocusController target={selectedPos} />

      <EffectComposer>
        <Bloom
          intensity={SCENE.bloom.intensity}
          luminanceThreshold={SCENE.bloom.luminanceThreshold}
          luminanceSmoothing={SCENE.bloom.luminanceSmoothing}
          mipmapBlur
        />
        <Vignette offset={SCENE.vignette.offset} darkness={SCENE.vignette.darkness} />
      </EffectComposer>
    </Canvas>
  );
}
