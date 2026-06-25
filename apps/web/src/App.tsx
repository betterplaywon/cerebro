import { useCallback, useState } from 'react';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { searchCerebro } from './api/client';
import { SearchBar } from './components/SearchBar';
import { CerebroLoader } from './components/CerebroLoader';
import { MindMapCanvas } from './components/MindMapCanvas';
import { DetailPanel } from './components/DetailPanel';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setStatus('loading');
    setError(null);
    setSelected(null);
    try {
      const res = await searchCerebro(query);
      setGraph(res.graph);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다');
      setStatus('error');
    }
  }, []);

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
            <MindMapCanvas
              graph={graph}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
            {selected && (
              <DetailPanel node={selected} graph={graph} onClose={() => setSelected(null)} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
