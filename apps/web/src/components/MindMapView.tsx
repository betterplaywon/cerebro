import { lazy, Suspense, useCallback, useState } from 'react';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { CerebroLoader } from './CerebroLoader';
import { DetailPanel } from './DetailPanel';
import { SourceSummary } from './SourceSummary';
import { CategoryLegend } from './CategoryLegend';

// 3D 캔버스(three.js)는 결과가 준비된 뒤에만 필요 → 초기 번들에서 분리(lazy).
const MindMapCanvas = lazy(() =>
  import('./MindMapCanvas').then((m) => ({ default: m.MindMapCanvas })),
);

/**
 * 준비된 그래프의 3D 표현 + 노드 선택 상호작용을 담당한다(App에서 분리해 SRP 확보).
 * 선택 노드는 이 뷰에만 필요한 **클라이언트 상태**라 여기에 co-locate한다(서버상태=graph는 prop).
 * 상위에서 `key={graph.generatedAt}`로 마운트해, 그래프가 바뀌면 선택이 자연히 초기화된다.
 */
export function MindMapView({ graph }: { graph: GraphSnapshot }) {
  const [selected, setSelected] = useState<GraphNode | null>(null);
  // 첫 노드 선택 = 조작법 습득 신호 → 안내 힌트 종료. (NodeView memo 유지를 위해 콜백은 안정 참조.)
  const [hintDismissed, setHintDismissed] = useState(false);

  const handleSelect = useCallback((node: GraphNode | null) => {
    setSelected(node);
    if (node) setHintDismissed(true);
  }, []);
  const closePanel = useCallback(() => setSelected(null), []);

  const branchCount = graph.nodes.filter((n) => n.kind !== 'center').length;
  const showHint = !hintDismissed && !selected && branchCount > 0;

  return (
    <div className="app__graph">
      {/* 3D 캔버스 청크는 곧 마운트되므로 무거운 시네마틱 대신 가벼운 셸로 폴백(여분 WebGL 컨텍스트 방지). */}
      <Suspense fallback={<CerebroLoader label="3D 그래프 준비 중…" mode="shell" />}>
        <MindMapCanvas graph={graph} selectedId={selected?.id ?? null} onSelect={handleSelect} />
      </Suspense>
      {selected && <DetailPanel node={selected} graph={graph} onClose={closePanel} />}
      <CategoryLegend graph={graph} />
      <SourceSummary sources={graph.sources} />
      {branchCount === 0 && (
        <p className="graph-note" role="status">
          공개 정보가 충분치 않아 표시할 가지가 적습니다.
        </p>
      )}
      {showHint && (
        <p className="graph-hint">노드를 클릭해 상세 정보 · 드래그해 회전 · 휠로 확대</p>
      )}
    </div>
  );
}
