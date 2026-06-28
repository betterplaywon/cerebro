import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { SCENE, timelineAt, writeFocusPosition, type CrowdLayout } from '../../lib/cerebro-timeline';

// 모듈 스코프 스크래치 — 단일 디렉터, 프레임당 할당 0.
const camWide = new Vector3();
const lookWide = new Vector3();
const camFocus = new Vector3();
const lookFocus = new Vector3();
const camTarget = new Vector3();
const lookTarget = new Vector3();
const focusPos = new Vector3();

/**
 * 카메라 연출(null 렌더, priority 0). timelineAt이 준 모드/스칼라로 목표 포즈를 만들고
 * per-axis MathUtils.damp로 부드럽게 추종한다(three 0.169엔 Vector3.damp가 없어 축별 스칼라 damp).
 *
 * 루프 주목: 군중 레이아웃 배열에서 인물 좌표를 읽어(GPU 리드백 X) 카메라를 그 앞 minApproach 거리에 둔다.
 * EffectComposer가 렌더를 가져가므로 모든 로직 useFrame은 priority 0으로 유지한다.
 */
export function CameraDirector({ layout }: { layout: CrowdLayout }) {
  const camera = useThree((s) => s.camera);
  const lookCurrent = useRef(new Vector3(0, -0.1, 0));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const tl = timelineAt(t, layout.focusCandidates);
    const dt = Math.min(delta, 0.05); // 탭 복귀 등 큰 dt 클램프(안정성)

    if (tl.camMode === 'intro') {
      const sway = Math.sin(t * 0.7) * 0.03;
      camTarget.set(sway, SCENE.cam.introBaseY, tl.camZ);
      lookTarget.set(sway * 0.5, tl.lookY, 0);
    } else {
      const a = tl.driftAngle;
      camWide.set(Math.sin(a) * 2.0, 0.6, SCENE.cam.restZ);
      lookWide.set(Math.sin(a * 0.7) * 1.5, -0.2, -10);
      writeFocusPosition(layout.positions, tl.focusIndex, focusPos);
      camFocus.set(focusPos.x * SCENE.crowd.focusXFactor, focusPos.y + 0.5, focusPos.z + tl.focusDist);
      lookFocus.copy(focusPos);
      camTarget.copy(camWide).lerp(camFocus, tl.focusBlend);
      lookTarget.copy(lookWide).lerp(lookFocus, tl.focusBlend);
    }

    const L = SCENE.cam.lambda;
    camera.position.x = MathUtils.damp(camera.position.x, camTarget.x, L, dt);
    camera.position.y = MathUtils.damp(camera.position.y, camTarget.y, L, dt);
    camera.position.z = MathUtils.damp(camera.position.z, camTarget.z, L, dt);
    const lc = lookCurrent.current;
    lc.x = MathUtils.damp(lc.x, lookTarget.x, L, dt);
    lc.y = MathUtils.damp(lc.y, lookTarget.y, L, dt);
    lc.z = MathUtils.damp(lc.z, lookTarget.z, L, dt);
    camera.lookAt(lc);
  });

  return null;
}
