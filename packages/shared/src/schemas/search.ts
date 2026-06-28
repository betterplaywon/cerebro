import { z } from 'zod';
import { GRAPH_LIMITS } from '../constants.js';
import { GraphSnapshotSchema, SubjectTypeSchema } from './graph.js';

/** 검색 요청 (클라이언트 → API) */
export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1, '검색어를 입력하세요').max(GRAPH_LIMITS.MAX_QUERY_LENGTH),
  /** 주제 유형 힌트(선택) — 없으면 서버가 추론 */
  type: SubjectTypeSchema.optional(),
});

/** 검색 응답 (API → 클라이언트) */
export const SearchResponseSchema = z.object({
  graph: GraphSnapshotSchema,
  /** 캐시 히트 여부(무료 운영/관측성) */
  cached: z.boolean(),
});

/** 표준 에러 응답 (일관된 에러 스키마) */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
