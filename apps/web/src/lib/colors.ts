import type { NodeKind } from '@cerebro/shared';

/**
 * 노드 카테고리 색 — DESIGN-SYSTEM §1.4 SSOT와 1:1 (이 맵이 3D/2D 단일 출처, ADR-0006).
 * 주의(의도된 결정, 임의 변경 금지):
 *  - 채널=핑크(#FF8FB1) / 평판=초록(#3FD68A) — 이전 코드의 의미(채널=청록/평판=핑크)를 SSOT 기준으로 교정(swap).
 *  - 평판(#3FD68A)=의미색 success, 뉴스(#F2B847)=의미색 warning과 색상 충돌은 SSOT가 의도한 것 —
 *    카테고리는 색만이 아니라 **아이콘+라벨**로 식별하므로 안전(WCAG AA, 색맹 대응).
 *  - concept(#8AA0FF)는 SSOT 미정의 → person(보라)과 구분되는 청보라로 등록(ADR-0006).
 */
export const NODE_COLORS: Record<NodeKind, string> = {
  center: '#37E0D8',
  product: '#5BD1FF',
  news: '#F2B847',
  person: '#A98BFF',
  channel: '#FF8FB1',
  reputation: '#3FD68A',
  concept: '#8AA0FF',
  attribute: '#8A93A8',
};

/** 노드 유형의 한국어 라벨 */
export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  center: '중심',
  product: '제품·서비스',
  news: '뉴스·이슈',
  person: '인물',
  channel: '채널·플랫폼',
  reputation: '평판·리뷰',
  concept: '관련 개념',
  attribute: '속성',
};

/** 노드 유형별 "정보 활용 방법" 안내 */
export const NODE_USAGE_HINTS: Record<NodeKind, string> = {
  center: '검색 주제의 핵심입니다. 가지를 펼쳐 관련 정보를 탐색하세요.',
  product: '대표 제품·서비스 정보입니다. 시장 포지션과 기능 비교에 활용하세요.',
  news: '최근 이슈·언급입니다. 동향 파악과 리스크 모니터링에 활용하세요.',
  person: '공개된 인물 정보입니다. 관계·역할 파악에 활용하세요(공개정보 한정).',
  channel: '공식 채널·플랫폼입니다. 접점 확인과 진위 검증에 활용하세요.',
  reputation: '평판·리뷰 신호입니다. 사용자 인식과 강·약점 파악에 활용하세요.',
  concept: '연관 키워드입니다. 탐색 범위를 넓히는 단서로 활용하세요.',
  attribute: '세부 속성·사실입니다. 근거 확인과 비교에 활용하세요.',
};
