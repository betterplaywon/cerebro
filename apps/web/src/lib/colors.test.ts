import { describe, expect, it } from 'vitest';
import { NODE_KINDS } from '@cerebro/shared';
import { NODE_COLORS, NODE_KIND_LABELS, NODE_USAGE_HINTS } from './colors';

/**
 * 팔레트 패리티: NODE_COLORS는 DESIGN-SYSTEM §1.4 SSOT와 정확히 일치해야 한다(2D/3D 단일 출처).
 * 색이 임의로 표류하면 이 테스트가 깨진다(ADR-0006).
 */
describe('NODE_COLORS = DESIGN-SYSTEM §1.4 SSOT', () => {
  it('카테고리 HEX가 SSOT와 일치한다', () => {
    expect(NODE_COLORS).toEqual({
      center: '#37E0D8',
      product: '#5BD1FF',
      news: '#F2B847',
      person: '#A98BFF',
      channel: '#FF8FB1',
      reputation: '#3FD68A',
      concept: '#8AA0FF',
      attribute: '#8A93A8',
      usage: '#FF9F5A',
    });
  });

  it('모든 NodeKind에 색·라벨·활용안내가 빠짐없이 정의된다', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_COLORS[kind]).toMatch(/^#[0-9A-F]{6}$/);
      expect(NODE_KIND_LABELS[kind]?.length).toBeGreaterThan(0);
      expect(NODE_USAGE_HINTS[kind]?.length).toBeGreaterThan(0);
    }
  });
});
