import type { SubjectType } from '@cerebro/shared';
import type { SourceAdapter } from '../sources/types.js';
import { getEnabledAdapters } from '../sources/registry.js';
import { normalize, type NormalizedItem } from './normalize.js';
import { dedupeByUrl } from './dedup.js';

export interface CollectResult {
  items: NormalizedItem[];
  usedAdapters: string[];
  failedAdapters: string[];
}

/**
 * 모든(또는 주입된) 어댑터를 병렬 수집하고 정규화·중복제거한다.
 * 한 어댑터가 실패해도 나머지 결과로 진행한다(allSettled).
 */
export async function collectAll(
  query: string,
  subjectType: SubjectType | undefined,
  collectedAt: string,
  adapters: SourceAdapter[] = getEnabledAdapters(),
): Promise<CollectResult> {
  const results = await Promise.allSettled(
    adapters.map((a) => a.collect({ query, subjectType })),
  );

  const items: NormalizedItem[] = [];
  const usedAdapters: string[] = [];
  const failedAdapters: string[] = [];
  let idx = 0;

  results.forEach((result, i) => {
    const adapter = adapters[i];
    if (!adapter) return;
    if (result.status === 'fulfilled') {
      usedAdapters.push(adapter.id);
      for (const raw of result.value) {
        items.push(normalize(raw, adapter.sourceType, `src-${idx}`, collectedAt));
        idx += 1;
      }
    } else {
      failedAdapters.push(adapter.id);
    }
  });

  return { items: dedupeByUrl(items), usedAdapters, failedAdapters };
}
