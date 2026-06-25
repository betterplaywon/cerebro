import { useMemo, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { layoutGraph, type Vec3 } from '../lib/layout';
import { NODE_COLORS } from '../lib/colors';

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

function NodeSphere({ node, position, selected, onSelect }: NodeSphereProps) {
  const [hovered, setHovered] = useState(false);
  const radius = 0.3 + node.importance * 0.7;
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

      <OrbitControls makeDefault enablePan enableZoom enableRotate />
    </Canvas>
  );
}
