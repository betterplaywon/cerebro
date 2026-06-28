/** 3D 마인드맵 씬 시각 튜닝 상수 — 매직넘버를 한곳에 모아 의미를 드러내고 튜닝을 쉽게 한다.
 *  씬 조립(MindMapCanvas)·노드 비주얼(NodeView)·카메라 리그(camera-controllers)가 공유하는 SSOT. */
export const SCENE = {
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
