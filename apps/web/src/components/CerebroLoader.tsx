import type { CSSProperties } from 'react';

const SILHOUETTE_COUNT = 14;

interface CerebroLoaderProps {
  label?: string;
}

/**
 * 세레브로 로딩 연출(MVP, CSS 버전): 회색 인간 실루엣들이 어둠 속을 스쳐 지나가고
 * 중앙의 한 점(검색 대상)이 맥동한다. 고도화(파티클/실루엣 시트)는 추후 UX 작업.
 * prefers-reduced-motion 에서는 모션을 멈춘다(index.css).
 */
export function CerebroLoader({ label = '세레브로 연결 중…' }: CerebroLoaderProps) {
  return (
    <div className="cerebro-loader" role="status" aria-live="polite">
      <div className="cerebro-field" aria-hidden="true">
        {Array.from({ length: SILHOUETTE_COUNT }).map((_, i) => (
          <span className="silhouette" key={i} style={{ '--i': i } as CSSProperties} />
        ))}
        <div className="cerebro-core" />
      </div>
      <p className="cerebro-loader__label">{label}</p>
    </div>
  );
}
