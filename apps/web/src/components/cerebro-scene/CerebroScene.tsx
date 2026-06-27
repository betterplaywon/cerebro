import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { SCENE, buildCrowdLayout } from '../../lib/cerebro-timeline';
import { CameraDirector } from './CameraDirector';
import { CrowdField } from './CrowdField';
import { HeroPortrait } from './HeroPortrait';
import { SpotlightGlow } from './SpotlightGlow';
import { SceneGrader, type BloomLike } from './SceneGrader';

/** 저사양(모바일·약한 GPU·저DPR)에선 군중 수를 낮춰 부드러움을 지킨다. */
function pickCount(): number {
  if (typeof navigator === 'undefined') return SCENE.crowd.count;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
  const lowDpr = (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) < 1.25;
  return coarse || weak || lowDpr ? SCENE.crowd.countLow : SCENE.crowd.count;
}

/**
 * 시네마틱 세레브로 로딩 씬(lazy default export). three는 이 서브그래프에서만 로드되어 엔트리 번들 밖에 머문다.
 * 카메라 디렉터를 **먼저** 두어 소비자보다 앞서 카메라를 갱신한다. 모든 연출은 순수 timelineAt(elapsed)에서 유도.
 */
export default function CerebroScene() {
  const count = useMemo(() => Math.min(pickCount(), SCENE.crowd.countMax), []);
  const layout = useMemo(() => buildCrowdLayout(count, SCENE.seed), [count]);
  // @react-three/postprocessing의 Bloom ref는 상위에서 effect 클래스로 잘못 타이핑돼 있어,
  // 런타임 인스턴스(.intensity 보유)를 콜백 ref로 받아 최소 구조(BloomLike)로 좁혀 저장한다.
  const bloomRef = useRef<BloomLike | null>(null);

  return (
    <Canvas
      className="cerebro-scene__canvas"
      camera={{ position: SCENE.cam.start, fov: SCENE.cam.fov, near: 0.1, far: 600 }}
      dpr={SCENE.dpr}
      gl={{ alpha: false, antialias: false, powerPreference: 'high-performance' }}
      style={{ pointerEvents: 'none' }}
    >
      {/* scene.background를 THREE.Color로 만든다(SceneGrader가 버스트로 보간). */}
      <color attach="background" args={[SCENE.color.bg]} />
      {/* 포그(거리 안개) — 라이트는 없다: 군중은 self-emissive raw 셰이더, 히어로는 unlit MeshBasic. */}
      <fog attach="fog" args={[SCENE.color.fog, SCENE.fog.near, SCENE.fog.far]} />

      <CameraDirector layout={layout} />
      <HeroPortrait layout={layout} />
      <CrowdField layout={layout} />
      <SpotlightGlow layout={layout} />
      <SceneGrader bloomRef={bloomRef} layout={layout} />

      <EffectComposer>
        <Bloom
          ref={(instance) => {
            bloomRef.current = instance as unknown as BloomLike | null;
          }}
          mipmapBlur
          intensity={SCENE.bloom.intensity}
          luminanceThreshold={SCENE.bloom.threshold}
          luminanceSmoothing={SCENE.bloom.smoothing}
        />
        <Vignette offset={SCENE.vignette.offset} darkness={SCENE.vignette.darkness} />
      </EffectComposer>
    </Canvas>
  );
}
