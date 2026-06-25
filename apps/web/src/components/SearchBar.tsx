import { useState, type FormEvent } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  disabled?: boolean;
}

export function SearchBar({ onSearch, disabled = false }: SearchBarProps) {
  const [value, setValue] = useState('');

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
