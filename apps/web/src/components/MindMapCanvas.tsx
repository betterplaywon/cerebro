import { useMemo, useState, type CSSProperties } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { GraphNode, GraphSnapshot, NodeKind } from '@cerebro/shared';
import { graphRadius, layoutGraph, type Vec3 } from '../lib/layout';
import { NODE_COLORS } from '../lib/colors';
import { CategoryIcon } from './CategoryIcon';
import { SCENE } from './mind-map/scene-config';
import { CameraRig, FocusController } from './mind-map/camera-controllers';

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
  hovered: boolean;
  onSelect: (node: GraphNode) => void;
}

/** 노드 위치의 작은 발광 코어 — Bloom이 번지게 해 글래스 타일 뒤로 글로우 헤일로를 만든다(상호작용 없음). */
function NodeGlow({ node, position }: { node: GraphNode; position: Vec3 }) {
  const color = NODE_COLORS[node.kind];
  const isCenter = node.kind === 'center';
  return (
    <mesh position={position}>
      <sphereGeometry
        args={[isCenter ? SCENE.glow.centerRadius : SCENE.glow.branchRadius, 20, 20]}
      />
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

/** 노드 라벨 = 글래스 아이콘 타일(Html, **시각 전용**: pointer-events 없음).
 *  마우스/터치 선택은 3D 히트 구(NodeHitTarget)가 담당해 드래그-회전을 가로채지 않는다.
 *  키보드 접근성을 위해 button은 유지(포커스+Enter로 선택; pointer-events:none이라 회전엔 영향 없음). */
function NodeTile({ node, position, selected, hovered, onSelect }: NodeViewProps) {
  const isCenter = node.kind === 'center';
  const isConcept = node.kind === 'concept';
  const variant = TILE_VARIANT_CLASS[node.kind] ?? '';
  const stateClass = `${selected ? ' is-selected' : ''}${hovered ? ' is-hover' : ''}`;
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
        className={`node-tile${variant}${stateClass}`}
        style={{ '--node-color': NODE_COLORS[node.kind] } as CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {!isConcept && (
          <span className="node-tile__icon">
            <CategoryIcon
              kind={node.kind}
              size={isCenter ? SCENE.tile.centerIcon : SCENE.tile.branchIcon}
            />
          </span>
        )}
        <span className="node-tile__label">{node.label}</span>
      </button>
    </Html>
  );
}

/** 노드별 투명 히트 구 — 클릭=선택, 호버=커서/하이라이트를 3D 레이캐스트로 처리한다.
 *  Html 타일에서 pointer-events를 떼어내 OrbitControls 드래그-회전이 어디서나 동작하게 만든다. */
function NodeHitTarget({
  node,
  position,
  onSelect,
  onHover,
}: {
  node: GraphNode;
  position: Vec3;
  onSelect: (node: GraphNode) => void;
  onHover: (id: string | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const radius = node.kind === 'center' ? SCENE.hit.center : SCENE.hit.branch;
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(node.id);
        gl.domElement.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        gl.domElement.style.cursor = '';
      }}
    >
      <sphereGeometry args={[radius, 12, 12]} />
      {/* 보이지 않지만 레이캐스트는 받는 표면(visible=false는 레이캐스트 제외되므로 opacity 0 사용). */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** 캔버스 내부 씬 그래프(라이트·엣지·노드 3계층·카메라 리그·후처리).
 *  `<Canvas>`와 분리해 실 WebGL 없이 test-renderer로 씬 구조를 검증할 수 있게 한다. */
export function MindMapScene({ graph, selectedId, onSelect }: MindMapCanvasProps) {
  const positions = useMemo(() => layoutGraph(graph), [graph]);
  const boundingRadius = useMemo(() => graphRadius(positions), [positions]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
    <>
      <ambientLight intensity={SCENE.lights.ambient} />
      <pointLight position={SCENE.lights.key.position} intensity={SCENE.lights.key.intensity} />
      <pointLight
        position={SCENE.lights.rim.position}
        intensity={SCENE.lights.rim.intensity}
        color={SCENE.lights.rim.color}
      />

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
        return position ? (
          <NodeGlow key={`glow-${node.id}`} node={node} position={position} />
        ) : null;
      })}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? (
          <NodeTile
            key={`tile-${node.id}`}
            node={node}
            position={position}
            selected={node.id === selectedId}
            hovered={node.id === hoveredId}
            onSelect={onSelect}
          />
        ) : null;
      })}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? (
          <NodeHitTarget
            key={`hit-${node.id}`}
            node={node}
            position={position}
            onSelect={onSelect}
            onHover={setHoveredId}
          />
        ) : null;
      })}

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={SCENE.orbit.minDistance}
        maxDistance={boundingRadius * SCENE.orbit.maxDistanceFactor}
      />
      <CameraRig radius={boundingRadius} />
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
    </>
  );
}

/** 3D 마인드맵: `<Canvas>` 설정 + 씬. 글로우 코어 + 글래스 아이콘 타일 + 글로우 가지 + 절제된 Bloom. */
export function MindMapCanvas(props: MindMapCanvasProps) {
  return (
    <Canvas
      camera={{ position: SCENE.camera.position, fov: SCENE.camera.fov }}
      dpr={SCENE.dpr}
      gl={{ alpha: true, antialias: true }}
    >
      <MindMapScene {...props} />
    </Canvas>
  );
}
