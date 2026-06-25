import { describe, expect, it } from 'vitest';
import {
  GraphSnapshotSchema,
  GraphNodeSchema,
  SearchRequestSchema,
} from '../index.js';

describe('GraphNodeSchema', () => {
  it('sourceIds 가 없으면 빈 배열로 기본값을 채운다', () => {
    const node = GraphNodeSchema.parse({
      id: 'n1',
      label: '중심',
      kind: 'center',
      importance: 1,
      confidence: 0.9,
    });
    expect(node.sourceIds).toEqual([]);
  });

  it('importance/confidence 는 0~1 범위를 벗어나면 거부한다', () => {
    expect(() =>
      GraphNodeSchema.parse({ id: 'n', label: 'x', kind: 'concept', importance: 1.5, confidence: 0 }),
    ).toThrow();
  });
});

describe('SearchRequestSchema', () => {
  it('빈 검색어를 거부한다', () => {
    expect(() => SearchRequestSchema.parse({ query: '   ' })).toThrow();
  });
});

describe('GraphSnapshotSchema', () => {
  it('유효한 스냅샷을 통과시킨다', () => {
    const now = '2026-06-25T00:00:00.000Z';
    const snapshot = {
      subject: { id: 's1', query: '토스', type: 'company', displayName: '토스' },
      nodes: [{ id: 'n1', label: '토스', kind: 'center', importance: 1, confidence: 0.95, sourceIds: ['src1'] }],
      edges: [],
      sources: [
        {
          id: 'src1',
          type: 'naver',
          title: '토스 소개',
          url: 'https://example.com/toss',
          collectedAt: now,
          confidence: 0.8,
        },
      ],
      generatedAt: now,
    };
    expect(() => GraphSnapshotSchema.parse(snapshot)).not.toThrow();
  });
});
