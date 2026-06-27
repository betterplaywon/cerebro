import type { CSSProperties } from 'react';

const SILHOUETTE_COUNT = 14;

/**
 * 순수 CSS 폴백(three 없음). 두 용도:
 * - variant="boot": 시네마틱 씬 청크가 로드되는 찰나의 Suspense 폴백.
 * - variant="static": prefers-reduced-motion 또는 씬 실패 시의 정적 대체(애니메이션은 index.css의 미디어쿼리가 멈춤).
 * 기존 .cerebro-field/.silhouette/.cerebro-core 스타일을 재사용한다.
 */
export function CerebroShell({ variant }: { variant: 'boot' | 'static' }) {
  return (
    <div className={`cerebro-shell cerebro-shell--${variant}`} aria-hidden="true">
      <div className="cerebro-field">
        {Array.from({ length: SILHOUETTE_COUNT }).map((_, i) => (
          <span className="silhouette" key={i} style={{ '--i': i } as CSSProperties} />
        ))}
        <div className="cerebro-core" />
      </div>
    </div>
  );
}
