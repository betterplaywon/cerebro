import type { NormalizedItem } from './normalize.js';

/**
 * URL 정규화 기준 중복 제거(host+path, 쿼리/해시/말미 슬래시 무시).
 * 동일 URL이 Layer A/B로 동시 수집되면 **분석 가능한 Layer B를 보존**한다(ADR-0014) —
 * 같은 콘텐츠를 상업 OK 소스(위키 등)로도 확보했다면 표시 전용 A 중복에 밀려선 안 된다.
 * 그 외에는 최초 등장 순서를 유지한다.
 */
export function dedupeByUrl(items: NormalizedItem[]): NormalizedItem[] {
  const byKey = new Map<string, NormalizedItem>();
  const order: string[] = [];
  for (const item of items) {
    const key = canonicalUrl(item.source.url);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      order.push(key);
    } else if (existing.layer === 'A' && item.layer === 'B') {
      byKey.set(key, item); // A→B 승격(순서는 유지, 내용만 교체)
    }
  }
  return order.map((key) => byKey.get(key)!);
}

function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return raw;
  }
}
