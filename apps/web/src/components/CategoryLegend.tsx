import { NODE_KINDS, type GraphSnapshot } from '@cerebro/shared';
import { NODE_COLORS, NODE_KIND_LABELS } from '../lib/colors';
import { CategoryIcon } from './CategoryIcon';

/**
 * 카테고리 범례(좌상단 오버레이). 3D 구체엔 텍스트 라벨이 없으므로 색이 무엇을 뜻하는지 알려준다.
 * **그래프에 실제로 존재하는** 카테고리만, NODE_KINDS 순서로 표시(중심 제외). 색+아이콘+라벨 3중 단서.
 */
export function CategoryLegend({ graph }: { graph: GraphSnapshot }) {
  const present = new Set(graph.nodes.map((n) => n.kind));
  const kinds = NODE_KINDS.filter((k) => k !== 'center' && present.has(k));
  if (kinds.length === 0) return null;

  return (
    <section className="legend" aria-label="카테고리 범례">
      <h2 className="legend__title">범례</h2>
      <ul className="legend__list">
        {kinds.map((kind) => (
          <li key={kind} className="legend__item">
            <span className="legend__icon" style={{ color: NODE_COLORS[kind] }}>
              <CategoryIcon kind={kind} />
            </span>
            <span className="legend__label">{NODE_KIND_LABELS[kind]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
