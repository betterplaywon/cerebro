import type { Source } from '@cerebro/shared';
import { summarizeSources } from '../lib/sources';

interface SourceSummaryProps {
  sources: Source[];
}

/**
 * 그래프 하단의 "분석된 출처 N건" 요약 + 유형별 한글 배지.
 * 정보의 출처를 투명하게 노출(PIPA·신뢰)하고, 어떤 공개 출처를 분석했는지 한눈에 보여준다.
 */
export function SourceSummary({ sources }: SourceSummaryProps) {
  const summary = summarizeSources(sources);

  if (summary.total === 0) return null;

  return (
    <aside className="source-summary" aria-label={`분석된 출처 ${summary.total}건`}>
      <span className="source-summary__total">분석된 출처 {summary.total}건</span>
      <ul className="source-summary__badges">
        {summary.byType.map((t) => (
          <li key={t.type} className="source-badge">
            <span className="source-badge__label">{t.label}</span>
            <span className="source-badge__count">{t.count}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
