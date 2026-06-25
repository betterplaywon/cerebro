import type { NormalizedItem } from './normalize.js';

/** URL 정규화 기준 중복 제거(host+path, 쿼리/해시/말미 슬래시 무시). */
export function dedupeByUrl(items: NormalizedItem[]): NormalizedItem[] {
  const seen = new Set<string>();
  const out: NormalizedItem[] = [];
  for (const item of items) {
    const key = canonicalUrl(item.source.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return raw;
  }
}
