import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnalysisSchema, ANALYSIS_JSON_SCHEMA, USAGE_ANGLES } from './report.js';

/**
 * 드리프트 잠금: zod `AnalysisSchema`와 손으로 쓴 `ANALYSIS_JSON_SCHEMA`가 어긋나면 실패한다.
 * 둘을 단일소스화하지 않는 이유: SDK의 zodOutputFormat은 enum을 description으로 강등시켜
 * 생성단계 enum 강제가 약해진다(리포트 전체 폴백 위험↑). 그래서 하드 enum 와이어 스키마를
 * 손으로 유지하되, 이 테스트가 두 표현의 정합성을 **양방향**으로 잠근다.
 *
 * 핵심: 기대값을 손으로 쓴 리터럴이 아니라 **zod 스키마에서 도출**해야 zod 측 변경(타입·옵셔널화)도 잡는다.
 */
const topShape = AnalysisSchema.shape;
const angleShape = AnalysisSchema.shape.angles.element.shape;
const enumOptions = [...AnalysisSchema.shape.angles.element.shape.key.options];

const topShapeMap = topShape as Record<string, z.ZodTypeAny>;
const angleShapeMap = angleShape as Record<string, z.ZodTypeAny>;

const jsonProps = ANALYSIS_JSON_SCHEMA.properties;
const jsonAngleItems = ANALYSIS_JSON_SCHEMA.properties.angles.items;
const jsonPropsLoose = jsonProps as unknown as Record<string, { type: string }>;
const jsonAnglePropsLoose = jsonAngleItems.properties as unknown as Record<string, { type: string }>;

/** zod 스키마 → 기대 JSON Schema `type` 문자열. 옵셔널/디폴트 래퍼는 벗긴 뒤 매핑한다. */
function jsonTypeOfZod(schema: z.ZodTypeAny): string {
  let s = schema;
  while (s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault) {
    s = s instanceof z.ZodDefault ? s.removeDefault() : s.unwrap();
  }
  if (s instanceof z.ZodString || s instanceof z.ZodEnum) return 'string';
  if (s instanceof z.ZodArray) return 'array';
  if (s instanceof z.ZodNumber) return s.isInt ? 'integer' : 'number';
  if (s instanceof z.ZodBoolean) return 'boolean';
  if (s instanceof z.ZodObject) return 'object';
  throw new Error(`매핑되지 않은 zod 타입: ${s.constructor.name}`);
}

/** zod shape에서 비-옵셔널(필수) 키만 추린다 — JSON Schema required와 비교용. */
function requiredKeysOf(shape: Record<string, z.ZodTypeAny>): string[] {
  return Object.keys(shape)
    .filter((k) => !shape[k]!.isOptional())
    .sort();
}

describe('Analysis 스키마 정합성(zod ↔ JSON Schema 드리프트 잠금)', () => {
  it('최상위 프로퍼티 키 집합이 zod와 일치한다(필드 추가/삭제 적발)', () => {
    expect(Object.keys(jsonProps).sort()).toEqual(Object.keys(topShape).sort());
  });

  it('angles 항목 프로퍼티 키 집합이 zod와 일치한다', () => {
    expect(Object.keys(jsonAngleItems.properties).sort()).toEqual(Object.keys(angleShape).sort());
  });

  it('required가 zod의 비-옵셔널 필드 집합과 일치한다(옵셔널화 드리프트 적발)', () => {
    expect([...ANALYSIS_JSON_SCHEMA.required].sort()).toEqual(requiredKeysOf(topShapeMap));
    expect([...jsonAngleItems.required].sort()).toEqual(requiredKeysOf(angleShapeMap));
  });

  it('필드 타입이 zod에서 도출한 기대 타입과 일치한다(양방향 타입 잠금)', () => {
    for (const [k, zs] of Object.entries(topShapeMap)) {
      expect(jsonPropsLoose[k]!.type).toBe(jsonTypeOfZod(zs));
    }
    for (const [k, zs] of Object.entries(angleShapeMap)) {
      expect(jsonAnglePropsLoose[k]!.type).toBe(jsonTypeOfZod(zs));
    }
    // 중첩 배열 항목 타입: sourceRefs 원소(zod int) ↔ JSON items.type. .int() 제거 시 number≠integer로 적발.
    expect(jsonAngleItems.properties.sourceRefs.items.type).toBe(
      jsonTypeOfZod(angleShape.sourceRefs.element),
    );
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
