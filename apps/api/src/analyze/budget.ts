/**
 * LLM 예산 서킷 브레이커(ADR-0013) — 누적 추정 비용이 상한에 도달하면 분석을 자동 차단한다.
 *
 * 비용·정책:
 *  - 키 게이트·캐시·폴백(ADR-0008/0011)에 더해 "지출 상한"을 코드로 봉인한다. 유일했던 방어가
 *    수동 키 제거뿐이라, 사고를 막기 위한 마지막 안전장치.
 *  - 인메모리 누적(기존 cache·rate-limit과 동일한 인스턴스 스코프). 프로세스 재시작 시 0으로 리셋되며
 *    다중 인스턴스는 카운터가 독립이다 — MVP 단일 인스턴스 전제(한계는 ADR-0013에 기록).
 *  - 리셋 윈도우 = UTC 달력 월. 월 경계를 넘으면 누적이 0으로 초기화되어 서킷이 닫힌다.
 *  - now 주입으로 월 경계를 테스트할 수 있게 한다(앱은 Date.now 기본).
 */

/**
 * 비용 계산에 쓰는 토큰 사용량(Anthropic `res.usage`의 부분집합과 구조 호환).
 * 캐시 토큰은 응답에 없을 수 있어 선택(누락/널은 0으로 취급).
 */
export interface BudgetUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** 관측 엔드포인트(GET /api/usage)로 노출하는 비민감 집계. 시크릿·키 값은 포함하지 않는다. */
export interface BudgetStats {
  /** 월 예산 상한(USD). */
  capUsd: number;
  /** 누적 추정 비용(USD). */
  spentUsd: number;
  /** 남은 예산(USD, 음수 없이 0으로 클램프). */
  remainingUsd: number;
  /** 서킷 오픈(차단) 여부 — true면 더 이상 LLM을 호출하지 않는다. */
  open: boolean;
  /** 현재 리셋 윈도우(UTC 달력 월) 시작 시각(ISO). */
  windowStart: string;
  /** 윈도우 내 누적 토큰(비민감). */
  tokens: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  };
}

export interface BudgetTracker {
  /** 누적 추정 비용이 상한 미만이면 true(허용). 도달/초과면 false(차단). */
  canSpend(): boolean;
  /** API가 청구한 토큰을 누적한다(응답 내용과 무관 — refusal/빈응답도 청구분은 기록). */
  record(usage: BudgetUsage): void;
  /** 관측용 비민감 집계 스냅샷. */
  getStats(): BudgetStats;
}

export interface BudgetTrackerOptions {
  /** 월 예산 상한(USD). 0이면 항상 차단(킬 스위치). */
  capUsd: number;
  /** 입력 토큰 단가(USD per 1M). 기본 Sonnet 4.6 = 3. */
  inputUsdPerMTok: number;
  /** 출력 토큰 단가(USD per 1M). 기본 Sonnet 4.6 = 15. */
  outputUsdPerMTok: number;
  /**
   * 캐시 쓰기(생성) 단가(USD per 1M). 미지정 시 Anthropic 표준 비율(입력 단가 × 1.25).
   * 현재 report.ts는 프롬프트 캐시를 쓰지 않지만, 응답에 토큰이 잡히면 보수적으로 합산한다.
   */
  cacheCreationUsdPerMTok?: number;
  /** 캐시 읽기 단가(USD per 1M). 미지정 시 Anthropic 표준 비율(입력 단가 × 0.1). */
  cacheReadUsdPerMTok?: number;
  /** 현재시각(ms) 주입 — 테스트의 월 경계 검증용. 미지정 시 Date.now. */
  now?: () => number;
}

const USD_PER_MTOK_DIVISOR = 1_000_000;

/** UTC 달력 월을 단조 증가 정수 키로(연·월 비교용). 키가 바뀌면 새 윈도우. */
function monthKey(ms: number): number {
  const d = new Date(ms);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** 월 키 → 해당 월 1일 00:00:00Z의 ISO 문자열(윈도우 시작 표시용). */
function windowStartIso(key: number): string {
  const year = Math.floor(key / 12);
  const month = key % 12;
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

/** 음수·NaN·null·undefined를 0으로 정규화(외부 응답 방어 — 잘못된 청구치가 누적을 오염시키지 않게). */
function nonNegative(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

export function createBudgetTracker(opts: BudgetTrackerOptions): BudgetTracker {
  const now = opts.now ?? Date.now;
  const inputPrice = opts.inputUsdPerMTok;
  const outputPrice = opts.outputUsdPerMTok;
  // 캐시 단가 기본값 = Anthropic 표준 비율(쓰기 1.25×·읽기 0.1× 입력단가).
  const cacheCreationPrice = opts.cacheCreationUsdPerMTok ?? inputPrice * 1.25;
  const cacheReadPrice = opts.cacheReadUsdPerMTok ?? inputPrice * 0.1;

  let windowKey = monthKey(now());
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;

  /** 월 경계를 넘었으면 누적을 0으로 리셋(서킷 닫힘). 모든 공개 메서드 진입 시 호출. */
  function rolloverIfNeeded(): void {
    const key = monthKey(now());
    if (key === windowKey) return;
    windowKey = key;
    inputTokens = 0;
    outputTokens = 0;
    cacheCreationTokens = 0;
    cacheReadTokens = 0;
  }

  function spentUsd(): number {
    return (
      (inputTokens / USD_PER_MTOK_DIVISOR) * inputPrice +
      (outputTokens / USD_PER_MTOK_DIVISOR) * outputPrice +
      (cacheCreationTokens / USD_PER_MTOK_DIVISOR) * cacheCreationPrice +
      (cacheReadTokens / USD_PER_MTOK_DIVISOR) * cacheReadPrice
    );
  }

  return {
    canSpend() {
      rolloverIfNeeded();
      return spentUsd() < opts.capUsd;
    },
    record(usage) {
      rolloverIfNeeded();
      inputTokens += nonNegative(usage.input_tokens);
      outputTokens += nonNegative(usage.output_tokens);
      cacheCreationTokens += nonNegative(usage.cache_creation_input_tokens);
      cacheReadTokens += nonNegative(usage.cache_read_input_tokens);
    },
    getStats() {
      rolloverIfNeeded();
      const spent = spentUsd();
      return {
        capUsd: opts.capUsd,
        spentUsd: spent,
        remainingUsd: Math.max(0, opts.capUsd - spent),
        open: spent >= opts.capUsd,
        windowStart: windowStartIso(windowKey),
        tokens: {
          input: inputTokens,
          output: outputTokens,
          cacheCreation: cacheCreationTokens,
          cacheRead: cacheReadTokens,
        },
      };
    },
  };
}
