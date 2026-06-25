import type { SourceAdapter } from './types.js';
import { exampleAdapter } from './example.js';

/** 등록된 모든 어댑터. 새 소스는 여기에 추가한다. */
const ADAPTERS: readonly SourceAdapter[] = [exampleAdapter];

export function getAllAdapters(): readonly SourceAdapter[] {
  return ADAPTERS;
}

/** 현재 사용 가능한(키 보유 등) 어댑터만. */
export function getEnabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.isEnabled());
}
