import { lazy, Suspense, useCallback, useState } from 'react';
import type { GraphNode } from '@cerebro/shared';
import { useCerebroSearch } from './hooks/useCerebroSearch';
import { SearchBar } from './components/SearchBar';
import { CerebroLoader } from './components/CerebroLoader';
import { DetailPanel } from './components/DetailPanel';
import { SourceSummary } from './components/SourceSummary';
import { CategoryLegend } from './components/CategoryLegend';

// 3D 캔버스(three.js)는 결과가 준비된 뒤에만 필요 → 초기 번들에서 분리(lazy).
const MindMapCanvas = lazy(() =>
  import('./components/MindMapCanvas').then((m) => ({ default: m.MindMapCanvas })),
);

export default function App() {
  // 서버상태(검색 결과)는 TanStack Query 훅이, 선택 노드(UI 상태)는 로컬 상태가 담당.
  const { status, graph, error, search } = useCerebroSearch();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      setSelected(null); // 새 검색이면 이전 선택 해제
      search(query);
    },
    [search],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__brand">cerebro</h1>
        <SearchBar onSearch={handleSearch} disabled={status === 'loading'} />
      </header>

      <main className="app__main">
        {status === 'idle' && (
          <p className="app__hint">기업·브랜드·공개 인물을 검색해 정보의 마인드맵을 펼쳐보세요.</p>
        )}
        {status === 'loading' && <CerebroLoader />}
        {status === 'error' && (
          <p className="app__error" role="alert">
            ⚠ {error}
          </p>
        )}
        {status === 'ready' && graph && (
          <div className="app__graph">
            <Suspense fallback={<CerebroLoader label="3D 그래프 준비 중…" />}>
              <MindMapCanvas
                graph={graph}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            </Suspense>
            {selected && (
              <DetailPanel node={selected} graph={graph} onClose={() => setSelected(null)} />
            )}
            <CategoryLegend graph={graph} />
            <SourceSummary sources={graph.sources} />
          </div>
        )}
      </main>
    </div>
  );
}
