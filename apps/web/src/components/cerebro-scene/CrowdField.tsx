import { useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { timelineAt, type CrowdLayout } from '../../lib/cerebro-timeline';
import { buildCrowdResources, type CrowdResources } from './crowd-shader';

/**
 * 단일 THREE.Points 군중 — draw call 1회로 수천 인물.
 *
 * StrictMode-safe 폐기: GPU 자원을 useMemo가 아니라 effect+state로 만든다. React 18 dev 더블마운트가
 * unmount-only cleanup을 돌려 같은 memo를 폐기-후-재사용하는 함정을 피한다(자원 생성·폐기를 한 수명에 묶음).
 */
export function CrowdField({ layout }: { layout: CrowdLayout }) {
  const gl = useThree((s) => s.gl);
  const [res, setRes] = useState<CrowdResources | null>(null);

  useEffect(() => {
    const r = buildCrowdResources(layout);
    r.uniforms.uPixelRatio.value = gl.getPixelRatio();
    setRes(r);
    return () => {
      r.geometry.dispose();
      r.material.dispose();
      r.sprite.dispose();
      setRes(null);
    };
  }, [layout, gl]);

  useFrame((state) => {
    if (!res) return;
    const t = state.clock.elapsedTime;
    const tl = timelineAt(t, layout.focusCandidates);
    const u = res.uniforms;
    u.uTime.value = t;
    u.uReveal.value = tl.uReveal;
    u.uFlash.value = tl.flash;
    u.uSpotStrength.value = tl.spotStrength;
    u.uPixelRatio.value = gl.getPixelRatio(); // 리사이즈/HiDPI 변화 대응
    const i = tl.focusIndex * 3;
    u.uSpot.value.set(
      layout.positions[i] ?? 0,
      layout.positions[i + 1] ?? 0,
      layout.positions[i + 2] ?? 0,
    );
  });

  if (!res) return null;
  // frustumCulled=false: 카메라가 군중 속을 비행할 때 바운딩 구 컬링으로 통째 사라지는 팝 방지.
  return <points geometry={res.geometry} material={res.material} frustumCulled={false} />;
}
