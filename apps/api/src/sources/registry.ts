import type { SourceAdapter } from './types.js';
import { wikipediaAdapter } from './wikipedia.js';
import { naverAdapter } from './naver.js';

/**
 * 등록된 모든 어댑터. 새 소스는 여기에 추가한다.
 * 키 필요 어댑터(naver)는 키 미설정 시 isEnabled()=false 로 자동 제외된다.
 * 광범위 웹검색(구글→Brave/Tavily)은 보류 — 무료 티어 축소로 MVP엔 부적합(ADR-0005).
 * (example 어댑터는 테스트 fixture 전용 — 프로덕션 레지스트리에 넣지 않는다)
 */
const ADAPTERS: readonly SourceAdapter[] = [wikipediaAdapter, naverAdapter];

export function getAllAdapters(): readonly SourceAdapter[] {
  return ADAPTERS;
}

/** 현재 사용 가능한(키 보유 등) 어댑터만. */
export function getEnabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.isEnabled());
}
