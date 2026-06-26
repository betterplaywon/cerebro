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

  it('조사를 떼어 표면형을 공통 어간으로 정규화한다', () => {
    // tokenize는 중복 제거를 하지 않으므로(상위 단계 담당) 모두 같은 어간으로 환원됨을 확인
    expect(tokenize('토스가 토스는 토스를')).toEqual(['토스', '토스', '토스']);
    expect(tokenize('대한민국의 역사')).toEqual(['대한민국', '역사']);
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

  it('조사가 붙은 표면형도 같은 토픽으로 집계된다(파편화 방지)', () => {
    const items = [
      normalize({ title: '토스가 출시', url: 'https://e.com/1' }, 'web', 's1', NOW),
      normalize({ title: '토스는 핀테크', url: 'https://e.com/2' }, 'naver', 's2', NOW),
      normalize({ title: '토스를 분석', url: 'https://e.com/3' }, 'wikipedia', 's3', NOW),
    ];
    const topics = extractTopics(items, 5);
    expect(topics[0]?.token).toBe('토스');
    expect(topics[0]?.sourceIds.slice().sort()).toEqual(['s1', 's2', 's3']);
  });
});
