import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Vec3 } from '../../lib/layout';
import { fitCameraDistance } from '../../lib/camera';
import { SCENE } from './scene-config';

/** 원점(중심 노드 위치) — CameraRig에서 읽기 전용으로 재사용. */
const ORIGIN = new Vector3(0, 0, 0);

export interface OrbitLike {
  target: Vector3;
  update: () => void;
}

/** FocusController·CameraRig가 공유하는 카메라/뷰포트/컨트롤 핸들 취득.
 *  OrbitControls는 R3F state(`controls`)에 느슨히 타이핑돼 있어 OrbitLike 단언을 이 한곳으로 모은다. */
function useOrbitHandles() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  return { camera, size, controls };
}

/** 노드 선택 시 카메라를 그 노드로 "포커스": 회전 중심(target)과 카메라 위치를 함께 보간해
 *  클릭한 노드를 화면 **중앙**에 두고, 현재 시야 방향을 유지한 채 **일정한 근접 거리로 확대**한다.
 *  → 멀리 있던 노드는 가까이 날아들며 확대되고, 정착하면 멈춰 사용자 조작을 방해하지 않는다. */
export function FocusController({ target }: { target: Vec3 | null }) {
  const { camera, size, controls } = useOrbitHandles();

  const destTarget = useMemo(
    () => (target ? new Vector3(target[0], target[1], target[2]) : null),
    [target],
  );
  const destPos = useRef<Vector3 | null>(null);
  const settled = useRef(false);

  // 선택이 바뀌면 목표 카메라 위치를 한 번 계산(시야 방향 유지 + 노드 기준 근접 거리).
  useEffect(() => {
    settled.current = false;
    if (!destTarget || !controls) {
      destPos.current = null;
      return;
    }
    const viewDir = camera.position.clone().sub(controls.target);
    if (viewDir.lengthSq() < 1e-6) viewDir.set(0, 0, 1);
    viewDir.normalize();
    const aspect = size.width / Math.max(size.height, 1);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : SCENE.camera.fov;
    const distance = fitCameraDistance(SCENE.focus.radius, fov, aspect, SCENE.fit.margin);
    destPos.current = destTarget.clone().addScaledVector(viewDir, distance);
  }, [destTarget, controls, camera, size.width, size.height]);

  useFrame(() => {
    if (!controls || !destTarget || !destPos.current || settled.current) return;
    controls.target.lerp(destTarget, SCENE.focus.lerp);
    camera.position.lerp(destPos.current, SCENE.focus.lerp);
    controls.update();
    const centered = controls.target.distanceTo(destTarget) < SCENE.focus.settleDistance;
    const zoomed = camera.position.distanceTo(destPos.current) < SCENE.focus.settleDistance;
    if (centered && zoomed) settled.current = true;
  });
  return null;
}

/** 그래프 바운딩 구를 종횡비에 맞춰 프레이밍 — three.js fov는 세로 화각이라 세로 화면(모바일)에선
 *  가로가 잘린다. 마운트·리사이즈 시 카메라 거리를 자동 조정한다(현재 시야 방향은 보존). */
export function CameraRig({ radius }: { radius: number }) {
  const { camera, size, controls } = useOrbitHandles();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const distance = fitCameraDistance(radius, camera.fov, aspect, SCENE.fit.margin);
    const target = controls?.target ?? ORIGIN;
    const dir = camera.position.clone().sub(target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.updateProjectionMatrix();
    controls?.update();
  }, [radius, size.width, size.height, camera, controls]);
  return null;
}
