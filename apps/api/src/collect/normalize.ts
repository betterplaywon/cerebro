import type { Source, SourceType } from '@cerebro/shared';
import type { RawItem } from '../sources/types.js';
import { stripParticle } from './korean.js';

export interface NormalizedItem {
  source: Source;
  /** 제목·스니펫에서 추출한 키워드 토큰 */
  tokens: string[];
}

const STOPWORDS = new Set([
  '그리고', '관련', '대한', '대해', '관한', '소개', '정보', '및', '등', '수', '것', '때', '더',
  '이런', '그런', '저런', '있다', '없다', '하는', '에서', '으로',
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'with', 'is', 'are',
]);

/**
 * 출처 링크가 http(s) 스킴인지 검사. 수집 경계에서 `javascript:`·`data:` 등
 * 위험 스킴 항목을 걸러 그래프(계약)에 유입되는 것을 막는다(XSS/SSRF 방지).
 */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 키워드 토큰화. 분리 후 한국어 조사를 떼어 같은 개체의 파편화를 막는다
 * (토스가/토스는/토스의 → 토스). 조사 분리 규칙·트레이드오프는 ADR-0004 / `korean.ts`.
 * 절단으로 토큰이 짧아질 수 있어 길이·불용어 필터를 한 번 더 적용한다.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    .map(stripParticle)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

const BASE_CONFIDENCE: Partial<Record<SourceType, number>> = {
  official: 0.9,
  wikipedia: 0.85,
  naver: 0.7,
  brave: 0.65,
  google: 0.7,
  appstore: 0.65,
  playstore: 0.65,
  web: 0.55,
  blog: 0.5,
  community: 0.45,
  sns: 0.4,
};

export function baseConfidence(type: SourceType): number {
  return BASE_CONFIDENCE[type] ?? 0.5;
}

export function normalize(
  raw: RawItem,
  type: SourceType,
  id: string,
  collectedAt: string,
): NormalizedItem {
  const source: Source = {
    id,
    type,
    title: raw.title,
    url: raw.url,
    snippet: raw.snippet,
    publishedAt: raw.publishedAt,
    collectedAt,
    confidence: baseConfidence(type),
  };
  const tokens = unique([...tokenize(raw.title), ...tokenize(raw.snippet ?? '')]);
  return { source, tokens };
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
