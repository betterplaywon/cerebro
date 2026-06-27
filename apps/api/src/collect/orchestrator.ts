import type { SubjectType } from '@cerebro/shared';
import type { SourceAdapter } from '../sources/types.js';
import { getEnabledAdapters } from '../sources/registry.js';
import { isHttpUrl, normalize, type NormalizedItem } from './normalize.js';
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
      // 위험 스킴(javascript:/data: 등) 링크는 계약 유입 전에 차단
      for (const raw of result.value) {
        if (!isHttpUrl(raw.url)) continue;
        // 항목별 sourceType이 있으면 우선(네이버 blog/cafe/kin 등 멀티-엔드포인트 어댑터).
        // layer는 항목별 오버라이드 없이 어댑터 단위로 전파(단일 진실원, ADR-0014).
        items.push(
          normalize(raw, raw.sourceType ?? adapter.sourceType, adapter.layer, `src-${idx}`, collectedAt),
        );
        idx += 1;
      }
    } else {
      failedAdapters.push(adapter.id);
    }
  });

  return { items: dedupeByUrl(items), usedAdapters, failedAdapters };
}
