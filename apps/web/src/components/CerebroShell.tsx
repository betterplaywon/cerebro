/**
 * 순수 CSS 폴백(three 없음). 두 용도:
 * - variant="boot": 시네마틱 씬 청크가 로드되는 찰나의 Suspense 폴백.
 * - variant="static": prefers-reduced-motion 또는 씬 실패 시의 정적 대체(애니메이션은 index.css의 미디어쿼리가 멈춤).
 * 시네마틱 로더와 동일한 다크 백드롭 위에 발광 코어만 둔다 — 과거 군중 픽토그램(silhouette) 연출은 제거해
 * 신규 시네마틱 로딩과 시각이 끊기지 않게 한다.
 */
export function CerebroShell({ variant }: { variant: 'boot' | 'static' }) {
  return (
    <div className={`cerebro-shell cerebro-shell--${variant}`} aria-hidden="true">
      <div className="cerebro-field">
        <div className="cerebro-core" />
      </div>
    </div>
  );
}
