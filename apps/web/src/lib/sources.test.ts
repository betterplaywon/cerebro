import { describe, expect, it } from 'vitest';
import { SOURCE_TYPES, type Source, type SourceType } from '@cerebro/shared';
import { SOURCE_TYPE_LABELS, summarizeSources } from './sources';

function mkSource(type: SourceType, id: string): Source {
  return {
    id,
    type,
    title: `${type} 제목`,
    url: `https://example.com/${id}`,
    collectedAt: '2026-06-26T00:00:00.000Z',
    confidence: 0.5,
  };
}

describe('SOURCE_TYPE_LABELS', () => {
  it('모든 출처 유형에 한국어 라벨이 존재한다', () => {
    for (const t of SOURCE_TYPES) {
      expect(SOURCE_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});

describe('summarizeSources', () => {
  it('빈 배열은 total 0, byType 빈 배열', () => {
    expect(summarizeSources([])).toEqual({ total: 0, byType: [] });
  });

  it('유형별 건수를 집계하고 total을 보존한다', () => {
    const sources = [
      mkSource('naver', '1'),
      mkSource('naver', '2'),
      mkSource('wikipedia', '3'),
    ];
    const { total, byType } = summarizeSources(sources);
    expect(total).toBe(3);
    expect(byType).toEqual([
      { type: 'naver', label: '네이버', count: 2 },
      { type: 'wikipedia', label: '위키백과', count: 1 },
    ]);
  });

  it('건수 내림차순, 동률은 SOURCE_TYPES 표준 순서로 결정적 정렬', () => {
    // naver 3, google 1, wikipedia 1 → naver, 그다음 동률은 google(표준순서 앞) → wikipedia
    const sources = [
      mkSource('wikipedia', '1'),
      mkSource('naver', '2'),
      mkSource('google', '3'),
      mkSource('naver', '4'),
      mkSource('naver', '5'),
    ];
    expect(summarizeSources(sources).byType.map((b) => b.type)).toEqual([
      'naver',
      'google',
      'wikipedia',
    ]);
  });
});
