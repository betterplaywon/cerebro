import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { PerspectiveCamera, Vector3 } from 'three';
import type { GraphNode, GraphSnapshot, NodeKind } from '@cerebro/shared';
import { graphRadius, layoutGraph, type Vec3 } from '../lib/layout';
import { fitCameraDistance } from '../lib/camera';
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
  glow: { centerRadius: 0.42, branchRadius: 0.18, centerEmissive: 1.2, branchEmissive: 0.8 },
  tile: { distanceFactor: 12, centerIcon: 20, branchIcon: 16 },
  edge: { color: '#3ac8f5', width: 1.3, opacity: 0.45 },
  /** lerp=프레임당 접근 비율, settleDistance=정착 임계, radius=포커스 시 노드+이웃을 담는 프레이밍 반경. */
  focus: { lerp: 0.12, settleDistance: 0.04, radius: 2.6 },
  /** 글로우는 은은하게: intensity↓·threshold↑로 가장 밝은 코어만 부드럽게 번지게(쨍한 헤일로 방지). */
  bloom: { intensity: 0.32, luminanceThreshold: 0.42, luminanceSmoothing: 0.9 },
  vignette: { offset: 0.3, darkness: 0.5 },
  /** 그래프 전체를 화면에 담을 때의 여백 배수(세로 화면에서 좌우 잘림 방지). */
  fit: { margin: 1.05 },
  /** 클릭/호버용 투명 히트 구 반경 — 작은 글로우 코어 대신 넉넉히 잡아 조준성↑. */
  hit: { center: 0.95, branch: 0.6 },
  /** 줌 한계: 너무 가깝거나(노드 통과) 너무 멀어(프레이밍 깨짐) 잘리지 않게. */
  orbit: { minDistance: 2.5, maxDistanceFactor: 10 },
};

/** 원점(중심 노드 위치) — CameraRig에서 읽기 전용으로 재사용. */
const ORIGIN = new Vector3(0, 0, 0);

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

interface OrbitLike {
  target: Vector3;
  update: () => void;
}

/** 노드 선택 시 카메라를 그 노드로 "포커스": 회전 중심(target)과 카메라 위치를 함께 보간해
 *  클릭한 노드를 화면 **중앙**에 두고, 현재 시야 방향을 유지한 채 **일정한 근접 거리로 확대**한다.
 *  → 멀리 있던 노드는 가까이 날아들며 확대되고, 정착하면 멈춰 사용자 조작을 방해하지 않는다. */
function FocusController({ target }: { target: Vec3 | null }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;

  const destTarget = useMemo(
    () => (target ? new Vector3(target[0], target[1], target[2]) : null),
    [target],
  );
  const destPos = useRef<Vector3 | null>(null);
  const settled = useRef(false);

  // 선택이 바뀌면 목표 카메라 위치를 한 번 계산(시야 방향 유지 + 노드 기준 근접 거리).
  useEffect(() => {
    settled.current = false;
    if (!destTarget || !controls) {
      destPos.current = null;
      return;
    }
    const viewDir = camera.position.clone().sub(controls.target);
    if (viewDir.lengthSq() < 1e-6) viewDir.set(0, 0, 1);
    viewDir.normalize();
    const aspect = size.width / Math.max(size.height, 1);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : SCENE.camera.fov;
    const distance = fitCameraDistance(SCENE.focus.radius, fov, aspect, SCENE.fit.margin);
    destPos.current = destTarget.clone().addScaledVector(viewDir, distance);
  }, [destTarget, controls, camera, size.width, size.height]);

  useFrame(() => {
    if (!controls || !destTarget || !destPos.current || settled.current) return;
    controls.target.lerp(destTarget, SCENE.focus.lerp);
    camera.position.lerp(destPos.current, SCENE.focus.lerp);
    controls.update();
    const centered = controls.target.distanceTo(destTarget) < SCENE.focus.settleDistance;
    const zoomed = camera.position.distanceTo(destPos.current) < SCENE.focus.settleDistance;
    if (centered && zoomed) settled.current = true;
  });
  return null;
}

/** 그래프 바운딩 구를 종횡비에 맞춰 프레이밍 — three.js fov는 세로 화각이라 세로 화면(모바일)에선
 *  가로가 잘린다. 마운트·리사이즈 시 카메라 거리를 자동 조정한다(현재 시야 방향은 보존). */
function CameraRig({ radius }: { radius: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const distance = fitCameraDistance(radius, camera.fov, aspect, SCENE.fit.margin);
    const target = controls?.target ?? ORIGIN;
    const dir = camera.position.clone().sub(target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.updateProjectionMatrix();
    controls?.update();
  }, [radius, size.width, size.height, camera, controls]);
  return null;
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
