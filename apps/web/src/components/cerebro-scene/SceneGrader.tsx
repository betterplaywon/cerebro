import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';
import { SCENE, timelineAt, type CrowdLayout } from '../../lib/cerebro-timeline';

/** Bloom 이펙트 핸들의 최소 구조(intensity만 보간). 'postprocessing' 직접 import 회피. */
export interface BloomLike {
  intensity: number;
}

// 모듈 스코프 색 — 프레임당 할당 0.
const BG_BASE = new Color(SCENE.color.bg);
const FOG_BASE = new Color(SCENE.color.fog);
const BURST = new Color(SCENE.color.burst);
const scratch = new Color();

/**
 * 색 보정(null 렌더, priority 0): dark→white→dark 하이브리드를 한곳에서 그레이딩한다.
 * 카메라-부착 쿼드를 쓰지 않는다(R3F v8은 기본 카메라를 씬에 추가하지 않아 렌더되지 않음).
 * 대신 scene.background(THREE.Color) + scene.fog.color + Bloom.intensity를 프레임마다 보간한다.
 */
export function SceneGrader({
  bloomRef,
  layout,
}: {
  bloomRef: RefObject<BloomLike | null>;
  layout: CrowdLayout;
}) {
  const scene = useThree((s) => s.scene);

  useFrame((state) => {
    const tl = timelineAt(state.clock.elapsedTime, layout.focusCandidates);
    // <color attach="background">의 scene.background는 THREE.Color다(.color 프로퍼티 아님).
    if (scene.background instanceof Color) {
      scene.background.copy(scratch.copy(BG_BASE).lerp(BURST, tl.bgWhiteT));
    }
    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(scratch.copy(FOG_BASE).lerp(BURST, tl.bgWhiteT));
    }
    const bloom = bloomRef.current;
    if (bloom) {
      bloom.intensity =
        SCENE.bloom.intensity + (SCENE.bloom.intensityBurst - SCENE.bloom.intensity) * tl.flash;
    }
  });

  return null;
}
