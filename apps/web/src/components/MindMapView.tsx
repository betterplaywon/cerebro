import { lazy, Suspense, useState } from 'react';
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

  return (
    <div className="app__graph">
      <Suspense fallback={<CerebroLoader label="3D 그래프 준비 중…" />}>
        <MindMapCanvas graph={graph} selectedId={selected?.id ?? null} onSelect={setSelected} />
      </Suspense>
      {selected && <DetailPanel node={selected} graph={graph} onClose={() => setSelected(null)} />}
      <CategoryLegend graph={graph} />
      <SourceSummary sources={graph.sources} />
    </div>
  );
}
