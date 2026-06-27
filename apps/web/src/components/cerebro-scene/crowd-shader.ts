/**
 * 군중 THREE.Points 자원 — GLSL·지오메트리·스프라이트 텍스처. three는 **여기서만** import한다.
 *
 * 핵심 결정:
 * - 단일 BufferGeometry + 단일 ShaderMaterial = draw call 1회로 ~5000 인물. setMatrixAt 불필요.
 * - gl_PointCoord 빌보드라 카메라를 향한 채 프레임당 CPU 0.
 * - 64×64 런타임 CanvasTexture(에셋 없음)로 각 점을 발광하는 "서 있는 사람" 실루엣으로.
 * - AdditiveBlending + Bloom으로 빛-사람 군집과 광선이 창발한다.
 *
 * 주의(raw ShaderMaterial): scene <fog>·톤매핑/컬러스페이스 청크를 받지 않는다.
 * → 먼 군중은 in-shader vBright 감쇠 + additive-to-black으로 void에 녹인다. 색은 디스플레이 공간에서 저술하고
 *   밝기를 절제해 5000 점 누적이 우윳빛으로 클리핑되지 않게 한다.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  ShaderMaterial,
  Vector3,
} from 'three';
import { SCENE, type CrowdLayout } from '../../lib/cerebro-timeline';

/** 64×64 발광 인물 실루엣(머리+테이퍼드 몸통)을 캔버스로 그려 CanvasTexture로 반환. */
export function makeHumanSprite(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 5; // 부드러운 가장자리(발광)
  // 머리
  ctx.beginPath();
  ctx.arc(size / 2, 16, 6, 0, Math.PI * 2);
  ctx.fill();
  // 몸통: 어깨 → 발끝으로 테이퍼
  ctx.beginPath();
  ctx.moveTo(24, 26);
  ctx.quadraticCurveTo(19, 42, 27, 58);
  ctx.lineTo(37, 58);
  ctx.quadraticCurveTo(45, 42, 40, 26);
  ctx.closePath();
  ctx.fill();
  const tex = new CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter; // 먼 점이 작아져도 깨끗이 다운샘플
  tex.needsUpdate = true;
  return tex;
}

/** 부드러운 원형 헤일로 — 루프에서 주목 인물 뒤를 비추는 SpotlightGlow 스프라이트용. */
export function makeGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(150,210,255,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildCrowdGeometry(layout: CrowdLayout): BufferGeometry {
  const g = new BufferGeometry();
  // layout의 Float32Array를 그대로 래핑(추가 복사 없음). positions는 JS에서 읽기 전용으로 공유.
  g.setAttribute('position', new BufferAttribute(layout.positions, 3));
  g.setAttribute('aSeed', new BufferAttribute(layout.seeds, 1));
  g.setAttribute('aTone', new BufferAttribute(layout.tones, 1));
  g.setAttribute('aSize', new BufferAttribute(layout.sizes, 1));
  return g;
}

const CROWD_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uScale;
  uniform float uReveal;
  uniform float uFlash;
  uniform vec3 uSpot;
  uniform float uSpotStrength;
  attribute float aSeed;
  attribute float aTone;
  attribute float aSize;
  varying float vBright;
  varying float vTone;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(-mv.z, 0.1);
    // 물리 픽셀 크기 = CSS크기 * dpr * 변주 * (스케일/거리), 과대 점 클램프
    gl_PointSize = clamp(uSize * aSize * uPixelRatio * (uScale / dist), 1.0, 64.0);
    float depthFade = 1.0 / (1.0 + 0.012 * dist);          // 먼 점은 어두워져 void로
    float twinkle = 0.7 + 0.3 * sin(uTime * 1.3 + aSeed * 6.2831853);
    float sd = distance(position, uSpot);
    float spot = uSpotStrength * smoothstep(6.0, 0.0, sd);  // 주목 인물 주변 점 강조
    // 스포트라이트도 depthFade로 감쇠 — 먼 점 다수가 additive로 누적돼 우윳빛 클리핑되는 것 방지.
    vBright = depthFade * (twinkle * (1.0 + uFlash * 1.5) + spot * 1.5);
    vTone = aTone;
    vAlpha = depthFade * uReveal;                           // uReveal: 전역 페이드인 게이트
  }
`;

const CROWD_FRAG = /* glsl */ `
  uniform sampler2D uSprite;
  uniform vec3 uColorNear;
  uniform vec3 uColorFar;
  varying float vBright;
  varying float vTone;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uSprite, gl_PointCoord);
    if (tex.a < 0.02) discard;
    vec3 c = mix(uColorFar, uColorNear, vTone);
    gl_FragColor = vec4(c * vBright, tex.a * vAlpha);
  }
`;

/** 군중 셰이더 유니폼 — 인덱스 시그니처(`material.uniforms[x]`) 대신 타입드 핸들로 접근(strict 안전). */
export interface CrowdUniforms {
  uTime: { value: number };
  uPixelRatio: { value: number };
  uSize: { value: number };
  uScale: { value: number };
  uReveal: { value: number };
  uFlash: { value: number };
  uSprite: { value: CanvasTexture };
  uSpot: { value: Vector3 };
  uSpotStrength: { value: number };
  uColorNear: { value: Color };
  uColorFar: { value: Color };
}

export interface CrowdResources {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  /** material.uniforms와 동일 객체를 가리키는 타입드 핸들(프레임 갱신용). */
  uniforms: CrowdUniforms;
  sprite: CanvasTexture;
}

/** 군중 자원 1세트 생성. useMemo가 아닌 effect 안에서 호출해 StrictMode 더블마운트에 안전하게 폐기한다. */
export function buildCrowdResources(layout: CrowdLayout): CrowdResources {
  const sprite = makeHumanSprite();
  const geometry = buildCrowdGeometry(layout);
  const material = new ShaderMaterial({
    // 인라인 리터럴은 ShaderMaterial의 인덱스 시그니처에 그대로 들어가고, 아래에서 타입드 뷰로 노출한다.
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 1 },
      uScale: { value: 224 }, // 거리 1당 CSS 픽셀 환산(경험적 튜닝)
      uReveal: { value: 0 },
      uFlash: { value: 0 },
      uSprite: { value: sprite },
      uSpot: { value: new Vector3() },
      uSpotStrength: { value: 0 },
      uColorNear: { value: new Color(SCENE.color.crowdNear) },
      uColorFar: { value: new Color(SCENE.color.crowdFar) },
    },
    vertexShader: CROWD_VERT,
    fragmentShader: CROWD_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
  const uniforms = material.uniforms as unknown as CrowdUniforms;
  return { geometry, material, uniforms, sprite };
}
