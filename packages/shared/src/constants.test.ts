import { describe, expect, it } from 'vitest';
import { EXAMPLE_QUERIES, NODE_KINDS, NODE_KIND_LABELS } from './index.js';

/**
 * NODE_KIND_LABELS 는 FE(범례·상세패널)와 BE(그래프/폴백 노드 label)가 공유하는
 * 사용자 노출 라벨 SSOT다. 한쪽만 바뀌어 패키지 경계에서 표류하면 이 테스트가 깨진다.
 */
describe('NODE_KIND_LABELS', () => {
  it('모든 NodeKind에 한국어 라벨이 빠짐없이 정의된다', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_KIND_LABELS[kind]?.length).toBeGreaterThan(0);
    }
  });

  it('사용자 노출 라벨 텍스트를 고정한다', () => {
    expect(NODE_KIND_LABELS).toEqual({
      center: '중심',
      product: '제품·서비스',
      news: '뉴스·이슈',
      person: '인물',
      channel: '채널·플랫폼',
      reputation: '평판·리뷰',
      concept: '관련 개념',
      attribute: '속성',
      usage: '활용 관점',
    });
  });
});

/**
 * EXAMPLE_QUERIES 는 홈 추천칩(FE)과 시드 프리웜(BE)이 공유하는 검색어 예시 SSOT다.
 * 프리웜 기동 비용 한도(8~15개)와 칩-시드 정합을 이 테스트로 고정한다.
 */
describe('EXAMPLE_QUERIES', () => {
  it('프리웜 기동 비용 한도(8~15개)를 지킨다', () => {
    expect(EXAMPLE_QUERIES.length).toBeGreaterThanOrEqual(8);
    expect(EXAMPLE_QUERIES.length).toBeLessThanOrEqual(15);
  });

  it('빈 문자열·중복이 없다', () => {
    expect(EXAMPLE_QUERIES.every((q) => q.trim().length > 0)).toBe(true);
    expect(new Set(EXAMPLE_QUERIES).size).toBe(EXAMPLE_QUERIES.length);
  });
});
