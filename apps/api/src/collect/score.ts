import type { NormalizedItem } from './normalize.js';

export interface Topic {
  token: string;
  /** 0~1, 최빈 토큰 대비 상대 빈도 */
  weight: number;
  /** 이 토픽을 뒷받침하는 출처 id들 */
  sourceIds: string[];
}

/**
 * 수집 항목의 토큰 빈도로 상위 토픽을 추출한다.
 * 여러 출처에 걸쳐 등장할수록 가중치가 높다(교차 출처 신호).
 */
export function extractTopics(items: NormalizedItem[], maxTopics: number): Topic[] {
  const freq = new Map<string, { count: number; sourceIds: Set<string> }>();

  for (const item of items) {
    for (const token of item.tokens) {
      const entry = freq.get(token) ?? { count: 0, sourceIds: new Set<string>() };
      entry.count += 1;
      entry.sourceIds.add(item.source.id);
      freq.set(token, entry);
    }
  }

  const counts = [...freq.values()].map((v) => v.count);
  const maxCount = counts.length ? Math.max(...counts) : 1;

  return [...freq.entries()]
    .map(([token, v]) => ({ token, weight: v.count / maxCount, sourceIds: [...v.sourceIds] }))
    .sort((a, b) => b.weight - a.weight || a.token.localeCompare(b.token))
    .slice(0, maxTopics);
}
