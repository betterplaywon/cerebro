import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type CanvasTexture, type Sprite, type SpriteMaterial } from 'three';
import { SCENE, timelineAt, type CrowdLayout } from '../../lib/cerebro-timeline';
import { makeGlowTexture } from './crowd-shader';

/**
 * 주목 인물 뒤의 부드러운 헤일로 — 루프에서 카메라를 더 들이밀지 않고도 한 명을 극적으로 비춘다
 * (점 빌보드의 평면성 노출 방지). opacity=spotStrength로 등장/퇴장.
 */
export function SpotlightGlow({ layout }: { layout: CrowdLayout }) {
  const [tex, setTex] = useState<CanvasTexture | null>(null);
  const spriteRef = useRef<Sprite>(null);
  const matRef = useRef<SpriteMaterial>(null);

  useEffect(() => {
    const t = makeGlowTexture();
    setTex(t);
    return () => {
      t.dispose();
      setTex(null);
    };
  }, []);

  useFrame((state) => {
    const tl = timelineAt(state.clock.elapsedTime, layout.focusCandidates);
    const s = spriteRef.current;
    const m = matRef.current;
    if (!s || !m) return;
    if (tl.spotStrength < 0.01) {
      s.visible = false;
      return;
    }
    s.visible = true;
    const i = tl.focusIndex * 3;
    s.position.set(
      layout.positions[i] ?? 0,
      layout.positions[i + 1] ?? 0,
      layout.positions[i + 2] ?? 0,
    );
    const sc = 6 + 2 * tl.spotStrength;
    s.scale.set(sc, sc, 1);
    m.opacity = tl.spotStrength * 0.8;
  });

  if (!tex) return null;
  return (
    <sprite ref={spriteRef} visible={false}>
      <spriteMaterial
        ref={matRef}
        map={tex}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        opacity={0}
        color={SCENE.color.accent}
      />
    </sprite>
  );
}
