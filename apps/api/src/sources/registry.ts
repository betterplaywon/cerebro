import type { SourceAdapter } from './types.js';
import { wikipediaAdapter } from './wikipedia.js';

/**
 * 등록된 모든 어댑터. 새 소스는 여기에 추가한다.
 * (example 어댑터는 테스트 fixture 전용 — 프로덕션 레지스트리에 넣지 않는다)
 */
const ADAPTERS: readonly SourceAdapter[] = [wikipediaAdapter];

export function getAllAdapters(): readonly SourceAdapter[] {
  return ADAPTERS;
}

/** 현재 사용 가능한(키 보유 등) 어댑터만. */
export function getEnabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.isEnabled());
}
