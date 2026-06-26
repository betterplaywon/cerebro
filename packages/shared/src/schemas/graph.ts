import { z } from 'zod';
import { NODE_KINDS, SOURCE_TYPES, SUBJECT_TYPES } from '../constants.js';

/**
 * 그래프 계약 (FE↔BE SSOT).
 * 정합성 결정: 노드는 출처를 `sourceIds: string[]`로 참조하고, 실제 Source는
 * GraphSnapshot.sources 에 한 번만 둔다. MVP는 노드당 0~1개를 채우되,
 * 배열로 두어 향후 다중 출처를 무중단 확장한다. (UX-SPEC `sources[]` ↔ DATA-MODEL 대표출처 정합)
 */

const unitInterval = z.number().min(0).max(1);
const isoDateTime = z.string().datetime({ message: 'ISO 8601 datetime 이어야 합니다' });

/**
 * 출처 링크 URL. http(s) 스킴만 허용한다.
 * `z.string().url()` 단독은 `javascript:`·`data:` 등 위험 스킴을 통과시키므로,
 * 링크가 화면에 `href`로 렌더되기 전 경계(SSOT)에서 차단한다(XSS 방지).
 */
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);
const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        return SAFE_URL_PROTOCOLS.has(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: 'http(s) URL만 허용됩니다' },
  );

export const SubjectTypeSchema = z.enum(SUBJECT_TYPES);
export const NodeKindSchema = z.enum(NODE_KINDS);
export const SourceTypeSchema = z.enum(SOURCE_TYPES);

/** 정보 출처 */
export const SourceSchema = z.object({
  id: z.string().min(1),
  type: SourceTypeSchema,
  title: z.string().min(1),
  url: httpUrl,
  snippet: z.string().optional(),
  author: z.string().optional(),
  /** 원문 게시 시각(있으면) */
  publishedAt: isoDateTime.optional(),
  /** 수집 시각 (보존 필수) */
  collectedAt: isoDateTime,
  /** 출처 신뢰도 0~1 */
  confidence: unitInterval,
});

/** 검색 주제(중심) */
export const SubjectSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  type: SubjectTypeSchema,
  displayName: z.string().min(1),
  description: z.string().optional(),
});

/** 그래프 노드(구체) */
export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: NodeKindSchema,
  summary: z.string().optional(),
  /** 중요도 0~1 — 중심에 가까울수록/강조될수록 높음 */
  importance: unitInterval,
  /** 정보 신뢰도 0~1 */
  confidence: unitInterval,
  /** 이 노드를 뒷받침하는 출처들(GraphSnapshot.sources 의 id 참조). MVP는 0~1개 */
  sourceIds: z.array(z.string().min(1)).default([]),
});

/** 그래프 가지(관계) */
export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  /** 출발 노드 id */
  source: z.string().min(1),
  /** 도착 노드 id */
  target: z.string().min(1),
  /** 관계 라벨 (예: "운영", "경쟁", "언급") */
  relation: z.string().min(1),
  /** 관계 강도 0~1 */
  weight: unitInterval,
});

/** 한 번의 검색 결과로 만들어진 그래프 스냅샷 */
export const GraphSnapshotSchema = z.object({
  subject: SubjectSchema,
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  sources: z.array(SourceSchema),
  /** 그래프 생성 시각 */
  generatedAt: isoDateTime,
});

export type SubjectType = z.infer<typeof SubjectTypeSchema>;
export type NodeKind = z.infer<typeof NodeKindSchema>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphSnapshot = z.infer<typeof GraphSnapshotSchema>;
