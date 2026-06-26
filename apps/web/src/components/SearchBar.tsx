import { useState, type FormEvent } from 'react';

interface SearchBarProps {
  /** 확정 검색어(URL) — 입력 드래프트의 초기값. 딥링크(`?q=`) 진입 시 입력칸을 채운다. */
  initialQuery?: string;
  onSearch: (query: string) => void;
  disabled?: boolean;
}

export function SearchBar({ initialQuery = '', onSearch, disabled = false }: SearchBarProps) {
  // 입력 드래프트는 컴포넌트 로컬 상태(미확정 타이핑). 확정 검색어(서버상태 트리거)는 URL이 담당.
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = value.trim();
    if (query) onSearch(query);
  }

  return (
    <form className="searchbar" onSubmit={handleSubmit} role="search">
      <input
        className="searchbar__input"
        aria-label="검색어"
        placeholder="기업·브랜드·공개 인물을 검색"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      <button className="searchbar__button" type="submit" disabled={disabled}>
        탐색
      </button>
    </form>
  );
}
