import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnalysisSchema, ANALYSIS_JSON_SCHEMA } from './report.js';

/**
 * 드리프트 잠금: zod `AnalysisSchema`와 손으로 쓴 `ANALYSIS_JSON_SCHEMA`가 어긋나면 실패한다.
 * 둘을 단일소스화하지 않는 이유: API output_config에 넘기는 와이어 스키마(JSON Schema)와 파서가
 * 기대하는 형태(zod)가 한쪽만 바뀌면 조용히 폴백되기 때문 — 이 테스트가 두 표현을 **양방향**으로 잠근다.
 *
 * ADR-0019: 관점(angle)은 고정 enum이 아니라 LLM이 동적으로 생성한 `label`(자유 문자열)이다.
 * 따라서 enum 정합 잠금은 제거하고, 라벨이 enum 제약 없는 자유 문자열임을 검증한다.
 * 키집합·타입·required·additionalProperties 드리프트 잠금은 그대로 유지한다.
 */
const topShape = AnalysisSchema.shape;
const angleShape = AnalysisSchema.shape.angles.element.shape;

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

  it('label은 enum 제약 없는 자유 문자열이다(ADR-0019 동적 관점)', () => {
    // 와이어 스키마: label에 enum이 없어야 한다(고정 후보 강제 제거).
    expect('enum' in jsonAngleItems.properties.label).toBe(false);
    expect(jsonAngleItems.properties.label.type).toBe('string');
    // zod: 임의의 라벨 문자열을 허용한다.
    for (const label of ['AI·데이터센터', '수출 규제 리스크', '무엇이든', '投資']) {
      expect(() =>
        AnalysisSchema.parse({ summary: 's', angles: [{ label, hook: 'h', report: 'r', sourceRefs: [] }] }),
      ).not.toThrow();
    }
  });

  it('additionalProperties=false가 양 레벨에 있다(엄격 출력)', () => {
    expect(ANALYSIS_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(jsonAngleItems.additionalProperties).toBe(false);
  });
});
