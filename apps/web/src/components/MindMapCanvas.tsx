import { useMemo, useState } from 'react';
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
  onSelect: (node: GraphNode) => void;
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
