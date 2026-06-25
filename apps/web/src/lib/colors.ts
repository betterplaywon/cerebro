import type { NodeKind } from '@cerebro/shared';

/** 노드 카테고리 색 (DESIGN-SYSTEM 카테고리 팔레트와 정합). */
export const NODE_COLORS: Record<NodeKind, string> = {
  center: '#7cf6ff',
  product: '#6ea8ff',
  news: '#ffd166',
  person: '#b794f6',
  channel: '#4fd1c5',
  reputation: '#f6739b',
  concept: '#9aa7ff',
  attribute: '#8a93a6',
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
