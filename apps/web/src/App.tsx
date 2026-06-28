import { useCerebroSearch } from './hooks/useCerebroSearch';
import { SearchBar } from './components/SearchBar';
import { CerebroLoader } from './components/CerebroLoader';
import { MindMapView } from './components/MindMapView';

/**
 * 페이지 셸 — 검색 입력과 합성된 검색 상태(SearchState)에 따른 뷰 라우팅만 담당한다.
 * 상태·데이터 합성은 useCerebroSearch가 끝내고(ready면 graph 보장), App은 합성 데이터를 소비만 한다(SRP).
 */
export default function App() {
  const { state, query, search } = useCerebroSearch();

  // 로고 = "홈으로" 어포던스. URL(`?q=`)이 검색의 단일 진실원이므로, 비우면 상태가 idle로 돌아가
  // 결과가 자연히 초기화된다(전체 리로드 없는 SPA 리셋 — 뒤로가기로 직전 검색 복원 가능).
  const resetToHome = () => search('');
  const hasResults = state.status !== 'idle';

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__brand">
          <button
            type="button"
            className="app__brand-button"
            onClick={resetToHome}
            disabled={!hasResults}
            aria-label="cerebro 홈으로 — 검색 결과 초기화"
          >
            cerebro
          </button>
        </h1>
        {/* key={query}: 확정 검색어(URL)가 바뀌면 입력 드래프트를 재동기화 → 로고 리셋 시 입력칸도 비워진다. */}
        <SearchBar
          key={query}
          initialQuery={query}
          onSearch={search}
          disabled={state.status === 'loading'}
        />
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
