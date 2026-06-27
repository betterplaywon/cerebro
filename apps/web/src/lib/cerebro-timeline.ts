/**
 * 세레브로 시네마틱 로딩의 **순수 타임라인 코어** — three를 import하지 않는다.
 *
 * 왜 three-free인가: CerebroLoader(즉시 로드되는 셸)와 MindMapCanvas의 lazy 경계를 지키려면,
 * 이 모듈을 통해 three가 엔트리 번들로 새어 들어가면 안 된다. 그래서 카메라/색/세기를
 * three 객체가 아닌 **순수 숫자·튜플**로 반환하고, 실제 Vector3/Color 변환은 씬 컨트롤러가 한다.
 *
 * 또한 모든 프레임 상태를 `timelineAt(elapsed)` **순수 함수**로 유도한다(React state 없음).
 * → 결정적이라 단위 테스트가 쉽고, 컨트롤러마다 같은 t로 호출해도 일관된다(staleness 없음).
 */

/** 시각 튜닝 매직넘버 SSOT. MindMapCanvas의 SCENE 관례를 따른다(주석은 "왜"). three 금지. */
export const SCENE = {
  /** dpr 상한 — 일시적 로더 + additive/Bloom이 에일리어싱을 가려 [1,2]보다 낮춰 부하↓. */
  dpr: [1, 1.5] as [number, number],
  /** 군중 배치 시드 — 결정적 레이아웃(테스트·재현 가능). */
  seed: 1337,
  cam: {
    fov: 52, // 군중 깊이감을 위해 MindMap(55)보다 좁게
    start: [0, 0.05, 2.6] as [number, number, number], // 초근접 (레퍼런스 Frame01)
    restZ: 14, // 군중 조망 안착 거리 (Frame05)
    lambda: 4.5, // per-axis damp 감쇠계수 — 프레임레이트 독립
    minApproach: 5.0, // 루프 주목 시 인물과 최소 거리 — 점 빌보드 평면성/센터컬링 팝 방지
    introBaseY: 0.05,
  },
  crowd: {
    count: 5000, // 단일 THREE.Points = draw call 1회
    countLow: 2200, // 저사양 하향
    countMax: 6000, // 하드 상한
    nearZ: -4, // 히어로 뒤 — 거대 근접 스프라이트 overdraw 차단
    farZ: -220, // 끝 — 셰이더 vBright 감쇠로 void에 녹음
    depthBias: 0.65, // <1: 먼 링에 점을 더 많이 = 사람의 벽(균일 화면 밀도)
    baseSpread: 6, // 근거리 좌우 폭
    spreadPerDepth: 0.55, // 깊이 비례 좌우 확산
    ySpreadBase: 0.6,
    ySpreadPerDepth: 0.22, // 먼 군중일수록 세로로도 퍼져 프레임을 채움(돔 느낌)
    yBias: 0.35, // 약간 아래(서 있는 군중) 쪽으로 치우침
    groundY: -0.6,
    sizeVarMin: 0.6,
    sizeVarMax: 1.5, // 개별 점 크기 변주
    focusNear: -10, // 루프에서 프레이밍하기 좋은 인물 밴드(가까움 한계)
    focusFar: -55, // (멈) — 너무 멀면 카메라 비행이 길어짐
    focusXFactor: 0.5, // 화면 중앙 가까운 후보만 픽
  },
  hero: {
    pos: [0, 0, 0] as [number, number, number],
    planeHeight: 2.4, // 이미지 평면 세로 크기(월드 단위) — 초근접 프레임을 채움
    fadeStart: 4.5,
    fadeEnd: 5.5, // 군중 점에 핸드오프되며 opacity→0 (디졸브)
  },
  color: {
    bg: '#05070f', // 앱 배경 네이비
    fog: '#070b16',
    burst: '#e8f3ff', // 순백(#ffffff) 금지 — 부드러운 빙결 화이트
    accent: '#7cf6ff', // 시안 강조(스포트라이트 글로우)
    crowdNear: '#cfeaff', // 가까운 인물(화이트에 가까움)
    crowdFar: '#5fc8ff', // 먼 인물(시안)
  },
  fog: { near: 4, far: 140 }, // 히어로 StandardMaterial 전용 (군중 raw 셰이더는 무시)
  bloom: { intensity: 0.7, intensityBurst: 1.6, threshold: 0.2, smoothing: 0.9 },
  vignette: { offset: 0.3, darkness: 0.65 }, // void 프레이밍
  intro: {
    total: 6.0,
    p0End: 1.6, // 근접(Frame01)
    p1End: 3.0, // 탈색·풀백(Frame02)
    p2End: 3.6, // 백색 버스트(Frame03)
    burstCenter: 3.3,
    burstHalf: 0.3, // 단일 펄스 폭(스트로브 아님)
    burstPeak: 0.85,
    bgWhiteHalf: 0.55, // 배경 화이트닝은 버스트보다 약간 길게
  },
  loop: {
    cycle: 9.0,
    pushEnd: 3.5, // 한 명 주목(천천히 접근)
    pullEnd: 5.0, // 급속 후퇴
    miniFlashPeak: 0.25, // 후퇴 시 약한 섬광(스트로브 임계 이하)
    miniFlashCenter: 3.7,
    miniFlashHalf: 0.3,
    driftSpeed: 0.12, // 유영 미세 회전
    focusDist: 5.0, // = minApproach: 주목 인물과 카메라 거리
  },
} as const;

export type CamMode = 'intro' | 'focus' | 'pullback' | 'drift';

/** 한 프레임의 연출 상태(레이아웃 독립). 카메라는 모드+스칼라로 주고, Vector3 합성은 컨트롤러가 한다. */
export interface TimelineState {
  phase: 'intro' | 'loop';
  camMode: CamMode;
  /** 인트로: 절대 카메라 z. 루프: 광역 기준 거리. */
  camZ: number;
  /** 인트로 시선 y. */
  lookY: number;
  /** 루프에서 주목할 군중 인덱스(focusCandidates에서 선택). */
  focusIndex: number;
  /** 0=광역, 1=주목 프레이밍 (루프). */
  focusBlend: number;
  /** 주목 시 카메라-인물 거리. */
  focusDist: number;
  /** 루프 유영 미세 회전 각. */
  driftAngle: number;
  /** 0=풀컬러, 1=회색(탈색). */
  heroColorT: number;
  heroOpacity: number;
  /** 0..burstPeak — 군중 uFlash + Bloom 세기로 사용. */
  flash: number;
  /** 0..1 — 배경/포그를 burst 화이트로 보간. */
  bgWhiteT: number;
  /** 0..1 — 군중 페이드인 게이트. */
  uReveal: number;
  /** 0..1 — 스포트라이트 글로우/군중 uSpotStrength. */
  spotStrength: number;
}

// ───────── 이징 (테스트에서 단조성 검증) ─────────
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 구간 정규화: t를 [a,b]에서 0..1로. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeInOutSine = (x: number): number => -(Math.cos(Math.PI * x) - 1) / 2;
export const easeInCubic = (x: number): number => x * x * x;
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeOutQuint = (x: number): number => 1 - Math.pow(1 - x, 5);
export const smoothstep01 = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** 단일 종 모양 펄스: center에서 1, |t-center|>=half에서 0. 부드럽고 스트로브 없음. */
export const bell = (t: number, center: number, half: number): number => {
  const x = Math.abs(t - center) / half;
  if (x >= 1) return 0;
  return 0.5 * (Math.cos(x * Math.PI) + 1);
};

// ───────── 군중 레이아웃 (순수, 결정적) ─────────
export interface CrowdLayout {
  count: number;
  /** count*3, [x,y,z]×count. BufferAttribute로 그대로 래핑된다. */
  positions: Float32Array;
  seeds: Float32Array; // twinkle 위상
  tones: Float32Array; // 0..1 화이트↔시안
  sizes: Float32Array; // 점 크기 변주
  /** 루프 주목에 적합한(중앙·중거리) 인물 인덱스 목록. */
  focusCandidates: number[];
}

/** 결정적 PRNG (mulberry32) — Math.random 대신 써서 레이아웃을 재현/테스트 가능하게. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 깊이 가중 분포로 군중을 배치한다. 먼 링에 점이 더 많아 "사람의 벽"이 된다. */
export function buildCrowdLayout(count: number, seed: number): CrowdLayout {
  const C = SCENE.crowd;
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const tones = new Float32Array(count);
  const sizes = new Float32Array(count);
  const focusCandidates: number[] = [];
  for (let i = 0; i < count; i++) {
    const z = C.nearZ + (C.farZ - C.nearZ) * Math.pow(rng(), C.depthBias);
    const halfW = C.baseSpread + Math.abs(z) * C.spreadPerDepth;
    const x = (rng() - 0.5) * 2 * halfW;
    const ySpread = C.ySpreadBase + Math.abs(z) * C.ySpreadPerDepth;
    const y = C.groundY + (rng() - C.yBias) * ySpread;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds[i] = rng();
    tones[i] = rng();
    sizes[i] = C.sizeVarMin + rng() * (C.sizeVarMax - C.sizeVarMin);
    if (z < C.focusNear && z > C.focusFar && Math.abs(x) < halfW * C.focusXFactor) {
      focusCandidates.push(i);
    }
  }
  if (focusCandidates.length === 0) focusCandidates.push(0);
  return { count, positions, seeds, tones, sizes, focusCandidates };
}

/** 사이클마다 결정적으로 서로 다른 후보를 고른다(정수 해시 → 후보 인덱스). */
export function pickFocusIndex(cycle: number, candidates: number[]): number {
  if (candidates.length === 0) return 0;
  const h = Math.imul(cycle + 1, 2654435761) >>> 0;
  return candidates[h % candidates.length] ?? 0;
}

// ───────── 타임라인 ─────────
function introState(t: number, candidates: number[]): TimelineState {
  const I = SCENE.intro;
  let camZ: number;
  if (t < I.p0End) camZ = lerp(2.6, 2.3, easeInOutSine(seg(t, 0, I.p0End)));
  else if (t < I.p1End) camZ = lerp(2.3, 6, easeInCubic(seg(t, I.p0End, I.p1End)));
  else if (t < I.p2End) camZ = lerp(6, 7, smoothstep01(seg(t, I.p1End, I.p2End)));
  else camZ = lerp(7, SCENE.cam.restZ, easeOutCubic(seg(t, I.p2End, I.total)));

  const heroColorT = seg(t, I.p0End, I.p1End); // 1.6s부터 3.0s까지 0→1 탈색
  const heroOpacity = 1 - seg(t, SCENE.hero.fadeStart, SCENE.hero.fadeEnd);
  const flash = I.burstPeak * bell(t, I.burstCenter, I.burstHalf);
  const bgWhiteT = bell(t, I.burstCenter, I.bgWhiteHalf);

  let uReveal: number;
  if (t < I.p0End) uReveal = 0;
  else if (t < I.p1End) uReveal = lerp(0, 0.4, seg(t, I.p0End, I.p1End));
  else if (t < I.p2End) uReveal = lerp(0.4, 0.85, seg(t, I.p1End, I.p2End));
  else uReveal = lerp(0.85, 1.0, seg(t, I.p2End, I.total));

  return {
    phase: 'intro',
    camMode: 'intro',
    camZ,
    lookY: -0.1,
    focusIndex: candidates[0] ?? 0,
    focusBlend: 0,
    focusDist: SCENE.loop.focusDist,
    driftAngle: 0,
    heroColorT,
    heroOpacity,
    flash,
    bgWhiteT,
    uReveal,
    spotStrength: 0,
  };
}

function loopState(lt: number, candidates: number[]): TimelineState {
  const L = SCENE.loop;
  const cyc = Math.floor(lt / L.cycle);
  const tt = lt - cyc * L.cycle; // 0..cycle
  const focusIndex = pickFocusIndex(cyc, candidates);

  let camMode: CamMode;
  let focusBlend: number;
  let flash = 0;
  if (tt < L.pushEnd) {
    camMode = 'focus';
    focusBlend = easeInOutSine(seg(tt, 0, L.pushEnd));
  } else if (tt < L.pullEnd) {
    camMode = 'pullback';
    focusBlend = 1 - easeOutQuint(seg(tt, L.pushEnd, L.pullEnd));
    flash = L.miniFlashPeak * bell(tt, L.miniFlashCenter, L.miniFlashHalf);
  } else {
    camMode = 'drift';
    focusBlend = 0;
  }

  return {
    phase: 'loop',
    camMode,
    camZ: SCENE.cam.restZ,
    lookY: -0.2,
    focusIndex,
    focusBlend,
    focusDist: L.focusDist,
    driftAngle: lt * L.driftSpeed + cyc * 0.7,
    heroColorT: 1,
    heroOpacity: 0,
    flash,
    bgWhiteT: flash * 0.4,
    uReveal: 1,
    spotStrength: focusBlend,
  };
}

/** 경과시간(초)에서 한 프레임의 연출 상태를 유도한다. 인트로 1회 → 사이클 무한 루프. */
export function timelineAt(elapsed: number, candidates: number[]): TimelineState {
  if (elapsed < SCENE.intro.total) return introState(elapsed, candidates);
  return loopState(elapsed - SCENE.intro.total, candidates);
}
