import { useCerebroSearch } from './hooks/useCerebroSearch';
import { SearchBar } from './components/SearchBar';
import { CerebroLoader } from './components/CerebroLoader';
import { MindMapView } from './components/MindMapView';

/**
 * 페이지 셸 — 검색 입력과 합성된 검색 상태(SearchState)에 따른 뷰 라우팅만 담당한다.
 * 상태·데이터 합성은 useCerebroSearch가 끝내고(ready면 graph 보장), App은 합성 데이터를 소비만 한다(SRP).
 */
export default function App() {
  const { state, search } = useCerebroSearch();

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__brand">cerebro</h1>
        <SearchBar onSearch={search} disabled={state.status === 'loading'} />
      </header>

      <main className="app__main">
        {state.status === 'idle' && (
          <p className="app__hint">기업·브랜드·공개 인물을 검색해 정보의 마인드맵을 펼쳐보세요.</p>
        )}
        {state.status === 'loading' && <CerebroLoader />}
        {state.status === 'error' && (
          <p className="app__error" role="alert">
            ⚠ {state.error}
          </p>
        )}
        {state.status === 'ready' && <MindMapView key={state.graph.generatedAt} graph={state.graph} />}
      </main>
    </div>
  );
}
