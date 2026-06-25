import type { SourceType, SubjectType } from '@cerebro/shared';

/** 어댑터가 수집해 반환하는 원시 항목(정규화 전). */
export interface RawItem {
  title: string;
  url: string;
  snippet?: string;
  /** 원문 게시 시각(ISO 8601), 있으면 */
  publishedAt?: string;
}

export interface CollectContext {
  query: string;
  subjectType?: SubjectType;
  /** 어댑터별 최대 수집 개수 */
  limit?: number;
  signal?: AbortSignal;
}

/**
 * 소스별 수집 어댑터. 새 소스는 이 인터페이스 구현 + registry 등록으로 추가한다.
 * (네이버/구글 등 키 필요 소스는 requiresKey=true, isEnabled()로 키 유무 판단)
 */
export interface SourceAdapter {
  readonly id: string;
  readonly sourceType: SourceType;
  readonly requiresKey: boolean;
  isEnabled(): boolean;
  collect(ctx: CollectContext): Promise<RawItem[]>;
}
