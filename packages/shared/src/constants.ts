/**
 * cerebro 공용 상수 (FE↔BE 공유).
 * 매직 넘버/문자열 방지 — 의미 있는 이름으로 단일 정의.
 */

/** 검색 주제(중심)의 유형 */
export const SUBJECT_TYPES = ['company', 'brand', 'product', 'person', 'unknown'] as const;

/** 그래프 노드의 카테고리 (DESIGN-SYSTEM 카테고리 색과 정합) */
export const NODE_KINDS = [
  'center', // 검색 주제 = 중심(가장 강조)
  'product', // 제품/서비스
  'news', // 뉴스/이슈
  'person', // 인물(공개정보)
  'channel', // 채널/플랫폼(앱스토어, SNS 등)
  'reputation', // 평판/리뷰/감성
  'concept', // 관련 개념/키워드
  'attribute', // 속성/사실
] as const;

/** 정보 출처의 유형 */
export const SOURCE_TYPES = [
  'naver',
  'brave',
  'google',
  'appstore',
  'playstore',
  'blog',
  'community',
  'sns',
  'wikipedia',
  'official',
  'web',
] as const;

/** 그래프 제약 (성능 예산 — 모바일 폴백 시 더 낮게) */
export const GRAPH_LIMITS = {
  MAX_NODES: 200,
  MAX_EDGES: 400,
  MAX_QUERY_LENGTH: 80,
} as const;
