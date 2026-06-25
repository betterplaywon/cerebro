import { describe, expect, it } from 'vitest';
import { normalize, tokenize } from './normalize.js';
import { dedupeByUrl } from './dedup.js';
import { extractTopics } from './score.js';

const NOW = '2026-06-25T00:00:00.000Z';

describe('tokenize', () => {
  it('불용어와 1글자 토큰을 제거한다', () => {
    expect(tokenize('토스 제품 소개 the a')).toEqual(['토스', '제품']);
  });

  it('순수 숫자 토큰을 제거한다(년도 등은 유지)', () => {
    expect(tokenize('삼성 039 2020년')).toEqual(['삼성', '2020년']);
  });
});

describe('dedupeByUrl', () => {
  it('쿼리/해시/말미슬래시를 무시하고 중복 제거', () => {
    const a = normalize({ title: 'x', url: 'https://e.com/a/' }, 'web', 's1', NOW);
    const b = normalize({ title: 'y', url: 'https://e.com/a?q=1#h' }, 'web', 's2', NOW);
    expect(dedupeByUrl([a, b])).toHaveLength(1);
  });
});

describe('extractTopics', () => {
  it('교차 출처 빈도가 높은 토픽을 상위로 둔다', () => {
    const items = [
      normalize({ title: '토스 제품', url: 'https://e.com/1' }, 'web', 's1', NOW),
      normalize({ title: '토스 뉴스', url: 'https://e.com/2' }, 'web', 's2', NOW),
    ];
    const topics = extractTopics(items, 5);
    expect(topics[0]?.token).toBe('토스');
    expect(topics[0]?.weight).toBe(1);
    expect(topics[0]?.sourceIds.slice().sort()).toEqual(['s1', 's2']);
  });
});
