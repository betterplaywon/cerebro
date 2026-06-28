import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { normalize, type NormalizedItem } from '../collect/normalize.js';
import { analyzeUsage } from './report.js';
import { createBudgetTracker } from './budget.js';

const SONNET = { inputUsdPerMTok: 3, outputUsdPerMTok: 15 } as const;

const NOW = '2026-06-25T00:00:00.000Z';

// ADR-0014: 분석(LLM)은 Layer B(상업 OK 소스)만 입력으로 받는다 → 픽스처를 위키백과(Layer B)로 둔다.
// (이전엔 naver=Layer A였으나, 레이어 게이트 도입 후엔 A만으론 analyzeUsage가 null이 되어 무의미.)
function sampleItems(): NormalizedItem[] {
  return [
    normalize(
      { title: '토스 대규모 투자 유치', url: 'https://ko.wikipedia.org/wiki/토스', snippet: '시리즈 투자' },
      'wikipedia',
      'B',
      's1',
      NOW,
    ),
    normalize(
      { title: '토스 개발자 채용 확대', url: 'https://ko.wikipedia.org/wiki/비바리퍼블리카', snippet: '대규모 채용' },
      'wikipedia',
      'B',
      's2',
      NOW,
    ),
  ];
}

/** 텍스트 블록 하나를 반환하는 가짜 Anthropic 클라이언트 + create 스파이. usage 주입 시 응답에 포함. */
function mockClient(
  text: string,
  stopReason: Anthropic.Message['stop_reason'] = 'end_turn',
  usage?: Partial<Anthropic.Usage>,
) {
  const create = vi.fn(async () => ({
    stop_reason: stopReason,
    content: [{ type: 'text', text }],
    ...(usage ? { usage } : {}),
  }));
  const client = { messages: { create } } as unknown as Pick<Anthropic, 'messages'>;
  return { client, create };
}

/** 전달된 user 메시지를 포착하는 가짜 클라이언트(레이어 필터링 검증용). */
function capturingClient(text: string) {
  let userContent = '';
  const create = vi.fn(async (params: { messages: Array<{ content: string }> }) => {
    userContent = params.messages[0]?.content ?? '';
    return { stop_reason: 'end_turn' as Anthropic.Message['stop_reason'], content: [{ type: 'text', text }] };
  });
  const client = { messages: { create } } as unknown as Pick<Anthropic, 'messages'>;
  return { client, create, getUserContent: () => userContent };
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

  it('LLM 산출물(summary·hook·report)의 PII를 출력측에서 재마스킹한다(ADR-0014 잔여위험)', async () => {
    const payload = JSON.stringify({
      summary: '대표 연락처는 010-1234-5678 이다.',
      angles: [
        { key: 'investment', hook: '문의 hong@test.com', report: '주민번호 900101-1234567 노출', sourceRefs: [0] },
      ],
    });
    const { client } = mockClient(payload);
    const result = await analyzeUsage('토스', sampleItems(), { client });
    expect(result!.summary).not.toContain('010-1234-5678');
    expect(result!.angles[0]?.hook).not.toContain('hong@test.com');
    expect(result!.angles[0]?.report).not.toContain('900101-1234567');
  });
});

// ── ADR-0014 소스 레이어 게이트: LLM 입력·인용은 Layer B만(네이버·카카오=Layer A 차단) ──
describe('analyzeUsage — ADR-0014 Layer 게이트', () => {
  const VALID = JSON.stringify({
    summary: '요약',
    angles: [{ key: 'investment', hook: 'h', report: 'r', sourceRefs: [0] }],
  });

  it('Layer A(네이버·카카오)만 있으면 LLM을 호출하지 않고 null 반환(지출 0)', async () => {
    const layerAOnly: NormalizedItem[] = [
      normalize({ title: '네이버 블로그 후기', url: 'https://blog.naver.com/u/9', snippet: '후기' }, 'blog', 'A', 'a1', NOW),
      normalize({ title: '카카오 웹문서', url: 'https://example.com/k', snippet: '문서' }, 'web', 'A', 'a2', NOW),
    ];
    const { client, create } = mockClient(VALID);
    expect(await analyzeUsage('토스', layerAOnly, { client })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('Layer A/B 혼합 시 Claude 입력과 인용에 Layer B만 포함한다', async () => {
    const mixed: NormalizedItem[] = [
      normalize({ title: '네이버 블로그 후기', url: 'https://blog.naver.com/u/9', snippet: 'A레이어 스니펫' }, 'blog', 'A', 'a1', NOW),
      normalize({ title: '위키 항목 본문', url: 'https://ko.wikipedia.org/wiki/X', snippet: 'B레이어 스니펫' }, 'wikipedia', 'B', 'b1', NOW),
    ];
    const { client, create, getUserContent } = capturingClient(VALID);
    const result = await analyzeUsage('토스', mixed, { client });

    expect(create).toHaveBeenCalledOnce();
    const userContent = getUserContent();
    expect(userContent).toContain('위키 항목 본문'); // Layer B는 전송
    expect(userContent).not.toContain('네이버 블로그 후기'); // Layer A 제목 차단
    expect(userContent).not.toContain('A레이어 스니펫'); // Layer A 스니펫 차단

    // 인용(sourceIds)도 Layer B만: 필터 후 top=[b1] → sourceRefs[0] → 'b1'
    expect(result!.angles[0]?.sourceIds).toEqual(['b1']);
  });
});

// ── ADR-0018 개인 전용 모드: PERSONAL_USE_MODE=true면 Layer A도 LLM 입력·인용에 포함 ──
describe('analyzeUsage — ADR-0018 개인 전용 모드', () => {
  const VALID = JSON.stringify({
    summary: '요약',
    angles: [{ key: 'investment', hook: 'h', report: 'r', sourceRefs: [0, 1] }],
  });

  // 이 블록만 개인 전용 모드 ON(기본 OFF는 위 ADR-0014 게이트 테스트가 커버). 종료 시 원복.
  let originalMode: boolean;
  beforeEach(() => {
    originalMode = env.PERSONAL_USE_MODE;
    env.PERSONAL_USE_MODE = true;
  });
  afterEach(() => {
    env.PERSONAL_USE_MODE = originalMode;
  });

  it('Layer A만 있어도 LLM을 호출하고 Layer A를 입력·인용에 포함한다', async () => {
    const layerAOnly: NormalizedItem[] = [
      normalize({ title: '네이버 블로그 후기', url: 'https://blog.naver.com/u/9', snippet: 'A레이어 스니펫' }, 'blog', 'A', 'a1', NOW),
      normalize({ title: '카카오 웹문서', url: 'https://example.com/k', snippet: '문서' }, 'web', 'A', 'a2', NOW),
    ];
    const { client, create, getUserContent } = capturingClient(VALID);
    const result = await analyzeUsage('토스', layerAOnly, { client });

    expect(create).toHaveBeenCalledOnce();
    expect(getUserContent()).toContain('네이버 블로그 후기'); // 개인 모드: Layer A 전송
    // 인용도 Layer A 포함(순서는 confidence 정렬에 좌우되므로 집합으로 비교)
    expect([...result!.angles[0]!.sourceIds].sort()).toEqual(['a1', 'a2']);
  });

  it('Layer A/B 혼합 시 둘 다 입력·인용에 포함한다(처음처럼)', async () => {
    const mixed: NormalizedItem[] = [
      normalize({ title: '네이버 블로그 후기', url: 'https://blog.naver.com/u/9', snippet: 'A레이어 스니펫' }, 'blog', 'A', 'a1', NOW),
      normalize({ title: '위키 항목 본문', url: 'https://ko.wikipedia.org/wiki/X', snippet: 'B레이어 스니펫' }, 'wikipedia', 'B', 'b1', NOW),
    ];
    const { client, getUserContent } = capturingClient(VALID);
    const result = await analyzeUsage('토스', mixed, { client });

    const userContent = getUserContent();
    expect(userContent).toContain('네이버 블로그 후기'); // Layer A도 전송
    expect(userContent).toContain('위키 항목 본문'); // Layer B도 전송
    expect([...result!.angles[0]!.sourceIds].sort()).toEqual(['a1', 'b1']); // 인용에 A·B 모두
  });
});

// ── 예산 서킷 브레이커 통합(ADR-0013) ──
describe('analyzeUsage — 예산 서킷 브레이커', () => {
  const VALID = JSON.stringify({
    summary: '요약',
    angles: [{ key: 'investment', hook: 'h', report: 'r', sourceRefs: [0] }],
  });

  it('서킷이 열린(예산 소진) 상태면 client.messages.create를 호출하지 않고 null 반환(지출 0)', async () => {
    const budget = createBudgetTracker({ capUsd: 0, ...SONNET }); // cap=0 → 처음부터 차단
    const { client, create } = mockClient(VALID, 'end_turn', { input_tokens: 100, output_tokens: 100 });
    expect(await analyzeUsage('토스', sampleItems(), { client, budget })).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(budget.getStats().spentUsd).toBe(0); // 호출 안 했으니 누적도 0
  });

  it('정상 호출 후 res.usage가 budget에 기록되어 누적 비용이 증가한다', async () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    const { client, create } = mockClient(VALID, 'end_turn', {
      input_tokens: 3000,
      output_tokens: 2500,
    });
    const result = await analyzeUsage('토스', sampleItems(), { client, budget });
    expect(result).not.toBeNull();
    expect(create).toHaveBeenCalledOnce();
    const stats = budget.getStats();
    expect(stats.tokens.input).toBe(3000);
    expect(stats.tokens.output).toBe(2500);
    expect(stats.spentUsd).toBeCloseTo(0.0465, 6);
  });

  it('cache_* 토큰도 함께 기록한다', async () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    const { client } = mockClient(VALID, 'end_turn', {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 400,
    });
    await analyzeUsage('토스', sampleItems(), { client, budget });
    const stats = budget.getStats();
    expect(stats.tokens.cacheCreation).toBe(200);
    expect(stats.tokens.cacheRead).toBe(400);
  });

  it('refusal이어도 res.usage가 있으면 청구분을 기록한다(early-return 전 record)', async () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    const { client } = mockClient('{}', 'refusal', { input_tokens: 1000, output_tokens: 500 });
    expect(await analyzeUsage('토스', sampleItems(), { client, budget })).toBeNull();
    expect(budget.getStats().tokens.input).toBe(1000);
    expect(budget.getStats().tokens.output).toBe(500);
  });

  it('빈 텍스트 응답이어도 res.usage가 있으면 청구분을 기록한다', async () => {
    const budget = createBudgetTracker({ capUsd: 8, ...SONNET });
    const { client } = mockClient('   ', 'end_turn', { input_tokens: 800, output_tokens: 0 });
    expect(await analyzeUsage('토스', sampleItems(), { client, budget })).toBeNull();
    expect(budget.getStats().tokens.input).toBe(800);
  });

  it('budget 미주입이면 기존 동작(예산 통제 없음)', async () => {
    const { client, create } = mockClient(VALID, 'end_turn', { input_tokens: 100, output_tokens: 100 });
    const result = await analyzeUsage('토스', sampleItems(), { client });
    expect(result).not.toBeNull();
    expect(create).toHaveBeenCalledOnce();
  });
});
