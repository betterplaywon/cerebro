import { EXAMPLE_QUERIES } from '@cerebro/shared';

/**
 * 빈 화면(idle)의 콜드스타트 마찰 완화 — 클릭하면 바로 탐색되는 예시 검색어 칩.
 * 목록은 검색어 예시 SSOT(`@cerebro/shared` EXAMPLE_QUERIES) — 시드 프리웜과 동일하므로
 * 칩 클릭이 데워진 캐시에 적중해 즉답한다. (대상·PIPA 정책은 SSOT 주석 참조.)
 */
export function SuggestedSearches({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="suggestions">
      <span className="suggestions__label">이런 검색은 어때요?</span>
      <ul className="suggestions__list">
        {EXAMPLE_QUERIES.map((q) => (
          <li key={q}>
            <button type="button" className="suggestions__chip" onClick={() => onSelect(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
