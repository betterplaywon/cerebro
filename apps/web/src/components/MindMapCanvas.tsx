import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Vector3 } from 'three';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { layoutGraph, type Vec3 } from '../lib/layout';
import { NODE_COLORS } from '../lib/colors';
import { CategoryIcon } from './CategoryIcon';

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
      <sphereGeometry args={[isCenter ? 0.42 : 0.18, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isCenter ? 1.7 : 1.15}
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
  const variant = isCenter ? ' node-tile--center' : isConcept ? ' node-tile--concept' : '';
  return (
    <Html position={position} center distanceFactor={12} zIndexRange={[0, 0]} wrapperClass="node-tile-wrap">
      <button
        type="button"
        className={`node-tile${variant}${selected ? ' is-selected' : ''}`}
        style={{ '--node-color': NODE_COLORS[node.kind] } as CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {!isConcept && (
          <span className="node-tile__icon">
            <CategoryIcon kind={node.kind} size={isCenter ? 20 : 16} />
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
    controls.target.lerp(dest, 0.12);
    controls.update();
    if (controls.target.distanceTo(dest) < 0.04) settled.current = true;
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
    <Canvas camera={{ position: [0, 0, 15], fov: 55 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.0} />
      <pointLight position={[-10, -6, -8]} intensity={0.45} color="#3a6bff" />

      {edgeLines.map((edge) => (
        <Line key={edge.id} points={edge.points} color="#3ac8f5" lineWidth={1.3} transparent opacity={0.45} />
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
        <Bloom intensity={0.55} luminanceThreshold={0.32} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette offset={0.3} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  );
}
