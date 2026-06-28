import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  type Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three';
import { SCENE, timelineAt, type CrowdLayout } from '../../lib/cerebro-timeline';
import { makeHeroPlaceholderTexture, resolveHeroAssetUrl } from './hero-texture';

/** map_fragment 직후 주입 — diffuseColor(맵 디코드 후)를 탈색/버스트 리프트/페이드한다. */
const HERO_MAP_INJECT = `#include <map_fragment>
  float heroLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(heroLuma), uDesat);  // 풀컬러 → 회색
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uBurst * 0.85); // 백색 버스트 리프트
  diffuseColor.a *= uOpacity;                                         // 디졸브 페이드아웃
`;

interface HeroUniforms {
  uDesat: { value: number };
  uBurst: { value: number };
  uOpacity: { value: number };
}

/**
 * 시작 인물(고품질 2D 이미지/일러스트). 풀컬러 클로즈업 → heroColorT로 회색 탈색 →
 * 버스트 시 백색으로 리프트 → ~5.5s opacity→0으로 디졸브되며 군중에 핸드오프된다.
 *
 * 색 정확성을 위해 raw ShaderMaterial 대신 MeshBasicMaterial + onBeforeCompile로 탈색만 주입한다
 * (three의 sRGB 디코드·톤매핑·인코드를 그대로 유지 → 사진/일러스트가 올바른 색으로 보인다).
 * GPU 자원은 effect+state로 만들어 StrictMode 더블마운트에 안전하게 폐기한다.
 */
export function HeroPortrait({ layout }: { layout: CrowdLayout }) {
  const camera = useThree((s) => s.camera);
  const heroUrl = useMemo(resolveHeroAssetUrl, []);
  const [tex, setTex] = useState<Texture | null>(null);
  const [mat, setMat] = useState<MeshBasicMaterial | null>(null);
  const meshRef = useRef<Mesh>(null);
  const uniformsRef = useRef<HeroUniforms | null>(null);

  // 텍스처: 사용자 에셋 비동기 로드(실패 시 플레이스홀더) 또는 플레이스홀더. 언마운트 시 폐기.
  useEffect(() => {
    let active = true;
    let created: Texture | null = null;
    const use = (t: Texture) => {
      created = t;
      if (active) setTex(t);
      else t.dispose();
    };
    if (heroUrl) {
      new TextureLoader().load(
        heroUrl,
        (t) => {
          t.colorSpace = SRGBColorSpace;
          use(t);
        },
        undefined,
        () => use(makeHeroPlaceholderTexture()), // 로드 실패 → 플레이스홀더
      );
    } else {
      use(makeHeroPlaceholderTexture());
    }
    return () => {
      active = false;
      if (created) created.dispose();
      setTex(null);
    };
  }, [heroUrl]);

  // 머티리얼: 텍스처가 준비되면 탈색 주입과 함께 생성. 언마운트 시 폐기(맵 텍스처는 위 effect가 폐기).
  useEffect(() => {
    if (!tex) return;
    const m = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    m.onBeforeCompile = (shader) => {
      const uDesat = { value: 0 };
      const uBurst = { value: 0 };
      const uOpacity = { value: 1 };
      shader.uniforms.uDesat = uDesat;
      shader.uniforms.uBurst = uBurst;
      shader.uniforms.uOpacity = uOpacity;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uDesat;\nuniform float uBurst;\nuniform float uOpacity;',
        )
        .replace('#include <map_fragment>', HERO_MAP_INJECT);
      uniformsRef.current = { uDesat, uBurst, uOpacity };
    };
    setMat(m);
    return () => {
      m.dispose();
      setMat(null);
      uniformsRef.current = null;
    };
  }, [tex]);

  // 이미지 비율로 평면 크기 결정(세로 고정, 가로=세로×비율).
  const { width, height } = useMemo(() => {
    const img = tex?.image as HTMLImageElement | HTMLCanvasElement | undefined;
    const aspect = img && img.width && img.height ? img.width / img.height : 2 / 3;
    const h = SCENE.hero.planeHeight;
    return { width: h * aspect, height: h };
  }, [tex]);

  useFrame((state) => {
    const tl = timelineAt(state.clock.elapsedTime, layout.focusCandidates);
    const u = uniformsRef.current;
    if (u) {
      u.uDesat.value = tl.heroColorT;
      u.uOpacity.value = tl.heroOpacity;
      // 글로우 세기(flash)에 직접 비례 — burstPeak를 낮추면 히어로 백색 리프트도 함께 은은해진다
      // (정규화로 항상 만개시키지 않음 → 배경이 거의 밝아지지 않는데 히어로만 새하얗게 튀는 부조화 방지).
      u.uBurst.value = tl.flash;
    }
    const mesh = meshRef.current;
    if (mesh) {
      mesh.visible = tl.heroOpacity > 0.001; // 사라진 뒤 렌더 스킵
      mesh.quaternion.copy(camera.quaternion); // 항상 카메라를 향하는 빌보드
    }
  });

  if (!mat) return null;
  return (
    <mesh ref={meshRef} material={mat} position={SCENE.hero.pos} renderOrder={2}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}
