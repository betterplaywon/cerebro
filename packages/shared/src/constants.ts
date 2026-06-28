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
  'usage', // 정보 활용 관점(투자/취업/경제…) — LLM 분석 리포트 노드
] as const;

/**
 * 노드 유형의 한국어 표시 라벨 (FE 범례·상세패널 + BE 그래프/폴백 노드 label 공용 SSOT).
 * NODE_KINDS 와 키가 1:1 — 새 종류 추가 시 여기도 채워야 타입이 통과한다.
 */
export const NODE_KIND_LABELS: Record<(typeof NODE_KINDS)[number], string> = {
  center: '중심',
  product: '제품·서비스',
  news: '뉴스·이슈',
  person: '인물',
  channel: '채널·플랫폼',
  reputation: '평판·리뷰',
  concept: '관련 개념',
  attribute: '속성',
  usage: '활용 관점',
};

/** 정보 출처의 유형 */
export const SOURCE_TYPES = [
  'naver',
  'google',
  'appstore',
  'playstore',
  'blog',
  'community',
  'sns',
  'wikipedia',
  'official',
  'publicdata', // 공공데이터포털(data.go.kr) 등 정부·공공 구조화 사실데이터 — Layer B(상업 OK). ADR-0015
  'web',
] as const;

/** 그래프 제약 (성능 예산 — 모바일 폴백 시 더 낮게) */
export const GRAPH_LIMITS = {
  MAX_NODES: 200,
  MAX_QUERY_LENGTH: 80,
} as const;

/**
 * 검색어 예시 (SSOT) — 홈 화면 추천칩(FE)과 시드 프리웜(BE)이 공유한다.
 * 한 목록을 공유해, 추천칩 클릭이 프리웜으로 데워진 캐시(스냅샷·리포트)에 적중하게 한다(즉답).
 *
 * 대상: 대표 기업·브랜드 + 공인(정치인·경영인·운동선수·연예인 등 공개정보 한정).
 * PIPA 골든룰: 개인은 **공인/공개정보 한정** 허용 — 비공개 개인의 신상은 금지.
 * 규모: 8~15개 유지(프리웜 기동 비용 방지, ADR-0011).
 */
export const EXAMPLE_QUERIES = [
  '삼성전자',
  '엔비디아',
  '네이버',
  '토스',
  '로켓랩',
  '현대자동차',
  'SK하이닉스',
  '젠슨황',
  '손흥민',
  '에스파',
] as const;
