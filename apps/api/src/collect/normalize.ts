import type { Source, SourceType } from '@cerebro/shared';
import type { RawItem } from '../sources/types.js';

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

/** 매우 단순한 토큰화(MVP). 한국어 형태소 분석은 추후 고도화 대상. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

const BASE_CONFIDENCE: Partial<Record<SourceType, number>> = {
  official: 0.9,
  wikipedia: 0.85,
  naver: 0.7,
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
