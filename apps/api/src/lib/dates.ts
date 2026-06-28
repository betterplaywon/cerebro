/** 임의 날짜 문자열을 epoch ms로 파싱한다. 비어있거나 파싱 불가면 null. Date.parse+NaN 검증 단일 소스. */
export function parseTimestamp(raw?: string): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/** 임의 날짜 문자열을 ISO 8601로 정규화한다. 비어있거나 파싱 불가면 undefined. */
export function toIsoDate(raw?: string): string | undefined {
  const t = parseTimestamp(raw);
  return t === null ? undefined : new Date(t).toISOString();
}
