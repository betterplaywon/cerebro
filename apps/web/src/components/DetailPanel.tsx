import type { CSSProperties } from 'react';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { NODE_COLORS, NODE_KIND_LABELS, NODE_USAGE_HINTS } from '../lib/colors';
import { SOURCE_TYPE_LABELS } from '../lib/sources';
import { CategoryIcon } from './CategoryIcon';

interface DetailPanelProps {
  node: GraphNode;
  graph: GraphSnapshot;
  onClose: () => void;
}

/** 노드 클릭 시 출처·신뢰도·활용 방법을 보여주는 상세 패널 (HTML 오버레이). */
export function DetailPanel({ node, graph, onClose }: DetailPanelProps) {
  const sources = graph.sources.filter((s) => node.sourceIds.includes(s.id));

  return (
    <aside className="detail-panel" role="dialog" aria-label={`${node.label} 상세 정보`}>
      <header className="detail-panel__header">
        <h2 className="detail-panel__title">{node.label}</h2>
        <button className="detail-panel__close" onClick={onClose} aria-label="닫기" type="button">
          ×
        </button>
      </header>

      {node.summary && <p className="detail-panel__summary">{node.summary}</p>}

      <dl className="detail-panel__meta">
        <div>
          <dt>유형</dt>
          <dd>
            <span className="cat-badge" style={{ '--cat': NODE_COLORS[node.kind] } as CSSProperties}>
              <span className="cat-badge__icon">
                <CategoryIcon kind={node.kind} size={13} />
              </span>
              {NODE_KIND_LABELS[node.kind]}
            </span>
          </dd>
        </div>
        <div>
          <dt>신뢰도</dt>
          <dd>{Math.round(node.confidence * 100)}%</dd>
        </div>
      </dl>

      <section className="detail-panel__section">
        <h3>출처</h3>
        {sources.length === 0 ? (
          <p className="muted">등록된 출처가 없습니다.</p>
        ) : (
          <ul className="detail-panel__sources">
            {sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {s.title}
                </a>
                <span className="src-meta">
                  <span className="src-meta__type">{SOURCE_TYPE_LABELS[s.type]}</span> · 수집{' '}
                  {new Date(s.collectedAt).toLocaleDateString('ko-KR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detail-panel__section">
        <h3>정보 활용 방법</h3>
        <p>{NODE_USAGE_HINTS[node.kind]}</p>
      </section>
    </aside>
  );
}
