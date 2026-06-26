import { describe, expect, it } from 'vitest';
import { graphRadius, type Vec3 } from './layout';

describe('graphRadius', () => {
  it('원점 기준 최대 거리를 반환한다', () => {
    const positions = new Map<string, Vec3>([
      ['a', [0, 0, 0]],
      ['b', [3, 0, 4]], // 거리 5
      ['c', [1, 2, 2]], // 거리 3
    ]);
    expect(graphRadius(positions)).toBeCloseTo(5, 5);
  });

  it('빈 그래프는 1을 반환한다(0 division 방지)', () => {
    expect(graphRadius(new Map())).toBe(1);
  });

  it('모든 노드가 반경 1 미만이어도 최소 1을 보장한다', () => {
    const positions = new Map<string, Vec3>([['a', [0.1, 0.1, 0.1]]]);
    expect(graphRadius(positions)).toBe(1);
  });
});
