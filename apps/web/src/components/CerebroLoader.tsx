import { lazy, Suspense } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ErrorBoundary } from './ErrorBoundary';
import { CerebroShell } from './CerebroShell';

// 시네마틱 R3F 씬은 three를 끌어온다 → lazy로 코드 분할해 엔트리 번들 밖에 둔다(MindMapCanvas와 같은 경계).
// reduced-motion이면 아래에서 렌더되지 않으므로 이 import는 실행되지 않는다(three 미다운로드).
const CerebroScene = lazy(() => import('./cerebro-scene/CerebroScene'));

interface CerebroLoaderProps {
  label?: string;
  /** 'cinematic'=R3F 군중 연출(기본). 'shell'=가벼운 CSS 폴백(3D 캔버스 청크 로딩 등 찰나용). */
  mode?: 'cinematic' | 'shell';
}

/**
 * 세레브로 시네마틱 로딩(X-Men Cerebro 오마주): 한 인물 → 회색 탈색 → 백색 버스트와 함께 줌아웃 →
 * 수천 발광 인물의 군중. 이후 한 명을 비췄다 다시 후퇴하는 사이클을 데이터 준비까지 반복한다.
 *
 * 즉시 로드되는 이 셸은 three를 import하지 않는다(번들 누출 방지). 무거운 씬은 Suspense 뒤에서 lazy 로드.
 */
export function CerebroLoader({ label = '세레브로 연결 중…', mode = 'cinematic' }: CerebroLoaderProps) {
  const reduced = useReducedMotion();
  const cinematic = mode === 'cinematic' && !reduced;

  return (
    <div className="cerebro-loader" role="status" aria-live="polite">
      <div className="cerebro-loader__stage">
        {cinematic ? (
          <ErrorBoundary fallback={<CerebroShell variant="static" />}>
            <Suspense fallback={<CerebroShell variant="boot" />}>
              <CerebroScene />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <CerebroShell variant={reduced ? 'static' : 'boot'} />
        )}
      </div>
      <p className="cerebro-loader__label">{label}</p>
    </div>
  );
}
