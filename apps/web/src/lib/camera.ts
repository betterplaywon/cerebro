/**
 * 카메라 프레이밍 계산(순수 함수 — three.js 의존 없이 단위 테스트 가능).
 *
 * three.js의 `fov`는 **세로(vertical) 화각**이라, 가로 화각은 종횡비에 비례한다:
 *   hFov = 2·atan(tan(vFov/2)·aspect)
 * 세로 화면(모바일, aspect<1)에서는 가로 화각이 좁아져 같은 거리에서 좌우가 잘린다.
 * 그래서 두 축 중 **더 좁은 화각**을 기준으로 카메라 거리를 정해야 전체가 들어온다.
 */

/** 라디안 환산 + 0 division 방지를 위한 최소 종횡비. */
const MIN_ASPECT = 1e-6;

/**
 * 반경 `radius`의 바운딩 구가 화면에 모두 들어오는 카메라 거리(구 중심 기준).
 * 가로·세로 화각 중 좁은 쪽을 기준으로 잡아 좌우/상하 어느 쪽도 잘리지 않게 한다.
 *
 * @param radius   담아야 할 바운딩 구 반경(월드 단위, >0)
 * @param fovDeg   카메라 세로 화각(도)
 * @param aspect   뷰포트 종횡비(width/height)
 * @param margin   여유 배수(1 = 딱 맞춤, 1.2 = 20% 여백). 기본 1.
 */
export function fitCameraDistance(radius: number, fovDeg: number, aspect: number, margin = 1): number {
  const vHalf = (fovDeg * Math.PI) / 360; // (fov/2) in radians
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(aspect, MIN_ASPECT));
  const limitingHalf = Math.min(vHalf, hHalf); // 좁은 화각이 거리를 지배
  return (radius / Math.sin(limitingHalf)) * margin;
}
