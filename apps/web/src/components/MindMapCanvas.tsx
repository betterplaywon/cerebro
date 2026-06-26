import { useMemo, useState, type CSSProperties } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { layoutGraph, type Vec3 } from '../lib/layout';
import { NODE_COLORS } from '../lib/colors';

/** 노드 반지름(구체·라벨 오프셋 공용) — 중요도에 비례. */
function nodeRadius(node: GraphNode): number {
  return 0.3 + node.importance * 0.7;
}

interface MindMapCanvasProps {
  graph: GraphSnapshot;
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

interface NodeSphereProps {
  node: GraphNode;
  position: Vec3;
  selected: boolean;
  onSelect: (node: GraphNode) => void;
}

/** 노드 위에 떠 있는 HTML 라벨. 한글 글리프를 위해 `<Text>`(폰트 번들 필요) 대신 `Html`로
 *  페이지 폰트(Pretendard/Noto Sans KR)를 그대로 쓴다. 카테고리 색 테두리, 중심·선택 강조. */
function NodeLabel({ node, position, selected }: Omit<NodeSphereProps, 'onSelect'>) {
  const labelY = position[1] + nodeRadius(node) + 0.25;
  const variant =
    node.kind === 'center'
      ? ' node-label--center'
      : node.kind === 'concept'
        ? ' node-label--concept'
        : '';
  return (
    <Html
      position={[position[0], labelY, position[2]]}
      center
      distanceFactor={10}
      zIndexRange={[0, 0]}
      wrapperClass="node-label-wrap"
    >
      <span
        className={`node-label${variant}${selected ? ' is-selected' : ''}`}
        style={{ '--node-color': NODE_COLORS[node.kind] } as CSSProperties}
      >
        {node.label}
      </span>
    </Html>
  );
}

function NodeSphere({ node, position, selected, onSelect }: NodeSphereProps) {
  const [hovered, setHovered] = useState(false);
  const radius = nodeRadius(node);
  const color = NODE_COLORS[node.kind];
  const emissiveIntensity = selected ? 0.95 : hovered ? 0.6 : 0.25;

  return (
    <mesh
      position={position}
      scale={selected || hovered ? 1.25 : 1}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(node);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
}

/** 3D 마인드맵: 노드=구체, 가지=선. 줌/팬/회전(OrbitControls), 노드 클릭 시 선택. */
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

  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 55 }} dpr={[1, 2]}>
      <color attach="background" args={['#05070f']} />
      <ambientLight intensity={0.65} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, -6, -8]} intensity={0.5} color="#3355ff" />

      {edgeLines.map((edge) => (
        <Line key={edge.id} points={edge.points} color="#2b3b66" lineWidth={1} transparent opacity={0.5} />
      ))}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return (
          <NodeSphere
            key={node.id}
            node={node}
            position={position}
            selected={node.id === selectedId}
            onSelect={onSelect}
          />
        );
      })}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return (
          <NodeLabel
            key={`label-${node.id}`}
            node={node}
            position={position}
            selected={node.id === selectedId}
          />
        );
      })}

      <OrbitControls makeDefault enablePan enableZoom enableRotate />
    </Canvas>
  );
}
