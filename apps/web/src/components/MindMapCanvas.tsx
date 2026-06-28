import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { graphRadius, layoutGraph, type Vec3 } from '../lib/layout';
import { SCENE } from './mind-map/scene-config';
import { CameraRig, FocusController } from './mind-map/camera-controllers';
import { NodeView } from './mind-map/NodeView';

interface MindMapCanvasProps {
  graph: GraphSnapshot;
  selectedId: string | null;
  /** 노드 선택. `null`이면 선택 해제(빈 공간 클릭 → 상세 패널 닫힘). */
  onSelect: (node: GraphNode | null) => void;
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
          <NodeView
            key={node.id}
            node={node}
            position={position}
            selected={node.id === selectedId}
            hovered={node.id === hoveredId}
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

/** 3D 마인드맵: `<Canvas>` 설정 + 씬. 글로우 코어 + 글래스 아이콘 타일 + 글로우 가지 + 절제된 Bloom.
 *  frameloop="demand": 결과 뷰는 대부분 정적이라 매프레임 렌더(기본 always)는 Bloom 풀파이프라인을
 *  유휴 중에도 60fps로 돌려 GPU·배터리를 낭비한다. 렌더는 변화가 있을 때만 — OrbitControls(makeDefault)
 *  조작·리사이즈는 R3F가 자동 invalidate하고, 카메라 포커스 비행(FocusController)만 수동으로 깨운다.
 *  antialias:false: EffectComposer가 멀티샘플 RT로 씬 AA를 담당하므로 컨텍스트 MSAA 백버퍼는
 *  이득 0의 이중 할당이다(자매 CerebroScene과 동일 설정). */
export function MindMapCanvas(props: MindMapCanvasProps) {
  // 빈 공간 클릭으로 선택 해제하되, 회전 드래그까지 해제로 오인하지 않도록 포인터 이동량을 가드한다.
  const downPos = useRef<{ x: number; y: number } | null>(null);
  return (
    <Canvas
      frameloop="demand"
      camera={{ position: SCENE.camera.position, fov: SCENE.camera.fov }}
      dpr={SCENE.dpr}
      gl={{ alpha: true, antialias: false }}
      onPointerDown={(e) => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMissed={(e) => {
        const d = downPos.current;
        const moved = d ? Math.hypot(e.clientX - d.x, e.clientY - d.y) : 0;
        if (moved < 6) props.onSelect(null); // 순수 클릭(≈제자리)만 선택 해제 — 드래그-회전은 유지
      }}
    >
      <MindMapScene {...props} />
    </Canvas>
  );
}
