/** 임의 날짜 문자열을 ISO 8601로 정규화한다. 비어있거나 파싱 불가면 undefined. */
export function toIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}
