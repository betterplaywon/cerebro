/**
 * 빈 화면(idle)의 콜드스타트 마찰 완화 — 클릭하면 바로 탐색되는 예시 검색어 칩.
 * 공개 기업·브랜드만 노출한다(PIPA: 개인은 공개정보/공인 한정이라 예시에선 제외).
 */
const SUGGESTIONS = ['삼성전자', '카카오', '네이버', '토스', '쿠팡', '배달의민족'] as const;

export function SuggestedSearches({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="suggestions">
      <span className="suggestions__label">이런 검색은 어때요?</span>
      <ul className="suggestions__list">
        {SUGGESTIONS.map((q) => (
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
