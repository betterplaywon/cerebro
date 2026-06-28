import { describe, expect, it } from 'vitest';
import { AnalysisSchema, ANALYSIS_JSON_SCHEMA, USAGE_ANGLES } from './report.js';

/**
 * 드리프트 잠금: zod `AnalysisSchema`와 손으로 쓴 `ANALYSIS_JSON_SCHEMA`가 어긋나면 실패한다.
 * 둘을 단일소스화하지 않는 이유: SDK의 zodOutputFormat은 enum을 description으로 강등시켜
 * 생성단계 enum 강제가 약해진다(리포트 전체 폴백 위험↑). 그래서 하드 enum 와이어 스키마를
 * 손으로 유지하되, 이 테스트가 두 표현의 정합성을 양방향으로 잠근다(한쪽만 수정하면 적발).
 */
const topShape = AnalysisSchema.shape;
const angleShape = AnalysisSchema.shape.angles.element.shape;
const enumOptions = [...AnalysisSchema.shape.angles.element.shape.key.options];

const jsonProps = ANALYSIS_JSON_SCHEMA.properties;
const jsonAngleItems = ANALYSIS_JSON_SCHEMA.properties.angles.items;

describe('Analysis 스키마 정합성(zod ↔ JSON Schema 드리프트 잠금)', () => {
  it('최상위 프로퍼티 키 집합이 zod와 일치한다', () => {
    expect(Object.keys(jsonProps).sort()).toEqual(Object.keys(topShape).sort());
  });

  it('최상위 required가 zod 필드 전체와 일치한다(모두 필수)', () => {
    expect([...ANALYSIS_JSON_SCHEMA.required].sort()).toEqual(Object.keys(topShape).sort());
  });

  it('angles 항목 프로퍼티 키 집합이 zod와 일치한다', () => {
    expect(Object.keys(jsonAngleItems.properties).sort()).toEqual(Object.keys(angleShape).sort());
  });

  it('angles 항목 required가 항목 필드 전체와 일치한다', () => {
    expect([...jsonAngleItems.required].sort()).toEqual(Object.keys(angleShape).sort());
  });

  it('key enum이 zod enum / USAGE_ANGLES와 단일소스로 일치한다', () => {
    const canonical = USAGE_ANGLES.map((a) => a.key);
    expect([...jsonAngleItems.properties.key.enum]).toEqual(canonical);
    expect(enumOptions).toEqual(canonical);
  });

  it('additionalProperties=false가 양 레벨에 있다(엄격 출력)', () => {
    expect(ANALYSIS_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(jsonAngleItems.additionalProperties).toBe(false);
  });

  it('필드 타입이 zod와 정합한다(타입 잠금)', () => {
    expect(jsonProps.summary.type).toBe('string');
    expect(jsonProps.angles.type).toBe('array');
    const ap = jsonAngleItems.properties;
    expect(ap.key.type).toBe('string');
    expect(ap.hook.type).toBe('string');
    expect(ap.report.type).toBe('string');
    expect(ap.sourceRefs.type).toBe('array');
    expect(ap.sourceRefs.items.type).toBe('integer');
  });

  it('zod가 enum 키만 허용한다(JSON Schema enum과 동일 집합 강제)', () => {
    for (const key of enumOptions) {
      expect(() =>
        AnalysisSchema.parse({ summary: 's', angles: [{ key, hook: 'h', report: 'r', sourceRefs: [] }] }),
      ).not.toThrow();
    }
    expect(() =>
      AnalysisSchema.parse({ summary: 's', angles: [{ key: '__nope__', hook: 'h', report: 'r', sourceRefs: [] }] }),
    ).toThrow();
  });
});
