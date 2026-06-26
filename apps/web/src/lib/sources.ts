import { SOURCE_TYPES, type Source, type SourceType } from '@cerebro/shared';

/** 출처 유형의 한국어 라벨 (화면 표기 — 색 단독 금지, 항상 라벨 동반). */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  naver: '네이버',
  brave: '브레이브',
  google: '구글',
  appstore: '앱스토어',
  playstore: '플레이스토어',
  blog: '블로그',
  community: '커뮤니티',
  sns: 'SNS',
  wikipedia: '위키백과',
  official: '공식',
  web: '웹',
};

/** 출처 유형별 집계 한 건 */
export interface SourceTypeCount {
  type: SourceType;
  label: string;
  count: number;
}

/** 출처 요약(전체 건수 + 유형별 집계) */
export interface SourceSummaryData {
  total: number;
  byType: SourceTypeCount[];
}

const TYPE_ORDER = new Map(SOURCE_TYPES.map((t, i) => [t, i]));

/**
 * 수집된 출처들을 유형별로 집계한다. "분석된 출처 N건(유형별)" 표기를 위한 순수 함수.
 * 정렬: 건수 내림차순, 동률은 SOURCE_TYPES 표준 순서(결정적)로 고정.
 */
export function summarizeSources(sources: Source[]): SourceSummaryData {
  const counts = new Map<SourceType, number>();
  for (const s of sources) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  }

  const byType: SourceTypeCount[] = [...counts.entries()]
    .map(([type, count]) => ({ type, label: SOURCE_TYPE_LABELS[type], count }))
    .sort((a, b) => b.count - a.count || (TYPE_ORDER.get(a.type) ?? 0) - (TYPE_ORDER.get(b.type) ?? 0));

  return { total: sources.length, byType };
}
