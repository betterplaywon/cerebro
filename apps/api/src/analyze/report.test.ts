import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { normalize, type NormalizedItem } from '../collect/normalize.js';
import { analyzeUsage } from './report.js';

const NOW = '2026-06-25T00:00:00.000Z';

function sampleItems(): NormalizedItem[] {
  return [
    normalize(
      { title: '토스 대규모 투자 유치', url: 'https://www.yna.co.kr/view/1', snippet: '시리즈 투자' },
      'naver',
      's1',
      NOW,
    ),
    normalize(
      { title: '토스 개발자 채용 확대', url: 'https://blog.naver.com/u/1', snippet: '대규모 채용' },
      'naver',
      's2',
      NOW,
    ),
  ];
}

/** 텍스트 블록 하나를 반환하는 가짜 Anthropic 클라이언트 + create 스파이. */
function mockClient(text: string, stopReason: Anthropic.Message['stop_reason'] = 'end_turn') {
  const create = vi.fn(async () => ({
    stop_reason: stopReason,
    content: [{ type: 'text', text }],
  }));
  const client = { messages: { create } } as unknown as Pick<Anthropic, 'messages'>;
  return { client, create };
}

// .env에 실제 키가 있어도 테스트는 항상 mock 클라이언트만 사용한다(네트워크 호출 0).
let originalKey: string | undefined;
beforeEach(() => {
  originalKey = env.ANTHROPIC_API_KEY;
  env.ANTHROPIC_API_KEY = 'test-key';
});
afterEach(() => {
  env.ANTHROPIC_API_KEY = originalKey;
});

describe('analyzeUsage', () => {
  it('키가 없으면 null을 반환하고 API를 호출하지 않는다(지출 0)', async () => {
    env.ANTHROPIC_API_KEY = undefined;
    const { client, create } = mockClient('{}');
    expect(await analyzeUsage('토스', sampleItems(), { client })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('수집 항목이 비면 null을 반환하고 API를 호출하지 않는다', async () => {
    const { client, create } = mockClient('{}');
    expect(await analyzeUsage('토스', [], { client })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('요약과 관점을 파싱하고 sourceRefs를 출처 id로 매핑한다', async () => {
    const payload = JSON.stringify({
      summary: '토스는 투자 유치와 채용을 확대하고 있다.',
      angles: [
        { key: 'investment', hook: '호재 가능성', report: '투자 유치는 성장 신호다. (투자 조언이 아님)', sourceRefs: [0, 1] },
        { key: 'career', hook: '채용 확대', report: '개발자 채용이 늘고 있어 구직 기회가 된다.', sourceRefs: [1] },
      ],
    });
    const { client, create } = mockClient(payload);
    const result = await analyzeUsage('토스', sampleItems(), { client });

    expect(create).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result!.summary).toContain('토스');
    expect(result!.angles).toHaveLength(2);

    const investment = result!.angles.find((a) => a.key === 'investment');
    expect(investment?.label).toBe('투자 관점');
    expect(investment?.sourceIds).toEqual(['s1', 's2']);

    const career = result!.angles.find((a) => a.key === 'career');
    expect(career?.sourceIds).toEqual(['s2']);
  });

  it('범위를 벗어난 sourceRefs는 버린다(존재하는 출처만 연결)', async () => {
    const payload = JSON.stringify({
      summary: '요약',
      angles: [{ key: 'investment', hook: 'h', report: 'r', sourceRefs: [0, 99] }],
    });
    const { client } = mockClient(payload);
    const result = await analyzeUsage('토스', sampleItems(), { client });
    expect(result!.angles[0]?.sourceIds).toEqual(['s1']);
  });

  it('본문이 빈 관점은 제외한다', async () => {
    const payload = JSON.stringify({
      summary: '요약',
      angles: [
        { key: 'investment', hook: 'h', report: '실제 본문', sourceRefs: [0] },
        { key: 'career', hook: 'h', report: '   ', sourceRefs: [1] },
      ],
    });
    const { client } = mockClient(payload);
    const result = await analyzeUsage('토스', sampleItems(), { client });
    expect(result!.angles).toHaveLength(1);
    expect(result!.angles[0]?.key).toBe('investment');
  });

  it('안전성 거부(refusal)면 null을 반환한다', async () => {
    const { client } = mockClient('{}', 'refusal');
    expect(await analyzeUsage('토스', sampleItems(), { client })).toBeNull();
  });
});
