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

  it('보조용언·시간 부사 등 빈출 노이즈를 제거한다', () => {
    expect(tokenize('토스가 있는 가장 최근 소식')).toEqual(['토스', '가장', '소식']);
  });

  it('날짜 조각(N월/N일)은 제외하되 연도(N년)는 유지한다', () => {
    expect(tokenize('출시 6월 26일 2026년 업데이트')).toEqual(['출시', '2026년', '업데이트']);
  });
});

describe('dedupeByUrl', () => {
  it('쿼리/해시/말미슬래시를 무시하고 중복 제거', () => {
    const a = normalize({ title: 'x', url: 'https://e.com/a/' }, 'web', 'A', 's1', NOW);
    const b = normalize({ title: 'y', url: 'https://e.com/a?q=1#h' }, 'web', 'A', 's2', NOW);
    expect(dedupeByUrl([a, b])).toHaveLength(1);
  });

  it('동일 URL이 A/B로 충돌하면 Layer B를 보존한다(분석 가능 항목 우선, ADR-0014)', () => {
    const a = normalize({ title: '네이버결과', url: 'https://ko.wikipedia.org/wiki/토스' }, 'naver', 'A', 'a1', NOW);
    const b = normalize({ title: '위키결과', url: 'https://ko.wikipedia.org/wiki/토스' }, 'wikipedia', 'B', 'b1', NOW);

    // A가 먼저 와도 B로 승격(등장 순서는 유지)
    const out = dedupeByUrl([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]?.layer).toBe('B');
    expect(out[0]?.source.id).toBe('b1');

    // B가 먼저여도 B 유지(다운그레이드 없음)
    const out2 = dedupeByUrl([b, a]);
    expect(out2[0]?.layer).toBe('B');
    expect(out2[0]?.source.id).toBe('b1');
  });
});

describe('extractTopics', () => {
  it('교차 출처 빈도가 높은 토픽을 상위로 둔다', () => {
    const items = [
      normalize({ title: '토스 제품', url: 'https://e.com/1' }, 'web', 'A', 's1', NOW),
      normalize({ title: '토스 뉴스', url: 'https://e.com/2' }, 'web', 'A', 's2', NOW),
    ];
    const topics = extractTopics(items, 5);
    expect(topics[0]?.token).toBe('토스');
    expect(topics[0]?.weight).toBe(1);
    expect(topics[0]?.sourceIds.slice().sort()).toEqual(['s1', 's2']);
  });

  it('조사가 붙은 표면형도 같은 토픽으로 집계된다(파편화 방지)', () => {
    const items = [
      normalize({ title: '토스가 출시', url: 'https://e.com/1' }, 'web', 'A', 's1', NOW),
      normalize({ title: '토스는 핀테크', url: 'https://e.com/2' }, 'naver', 'A', 's2', NOW),
      normalize({ title: '토스를 분석', url: 'https://e.com/3' }, 'wikipedia', 'B', 's3', NOW),
    ];
    const topics = extractTopics(items, 5);
    expect(topics[0]?.token).toBe('토스');
    expect(topics[0]?.sourceIds.slice().sort()).toEqual(['s1', 's2', 's3']);
  });
});
