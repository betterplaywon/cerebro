import { describe, expect, it } from 'vitest';
import { parseTimestamp, toIsoDate } from './dates.js';

describe('parseTimestamp', () => {
  it('유효한 날짜 문자열을 epoch ms로 파싱한다', () => {
    expect(parseTimestamp('2026-06-28T00:00:00.000Z')).toBe(Date.parse('2026-06-28T00:00:00.000Z'));
  });

  it('비어있거나 미지정이면 null', () => {
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
  });

  it('파싱 불가 문자열이면 null', () => {
    expect(parseTimestamp('not-a-date')).toBeNull();
  });

  it('epoch-0은 null이 아니라 0 — 호출부의 ?? 0 fallback이 "없음"과 구분할 수 있어야 한다', () => {
    expect(parseTimestamp('1970-01-01T00:00:00.000Z')).toBe(0);
    expect(parseTimestamp('1970-01-01T00:00:00.000Z') ?? -1).toBe(0); // ?? 는 null만 대체
  });
});

describe('toIsoDate (parseTimestamp 위에서 동작)', () => {
  it('유효 날짜를 ISO 8601로 정규화한다', () => {
    expect(toIsoDate('2026-06-28')).toBe(new Date('2026-06-28').toISOString());
  });

  it('비어있거나 파싱 불가면 undefined', () => {
    expect(toIsoDate(undefined)).toBeUndefined();
    expect(toIsoDate('not-a-date')).toBeUndefined();
  });
});
