import type { SourceType, SubjectType } from '@cerebro/shared';

/**
 * 소스 라이선스 레이어(ADR-0014). **단일 진실원 = 어댑터**.
 * `SourceType`(naver/blog/web…)은 제공자와 콘텐츠유형이 혼재해 라이선스 식별에 부적합하다
 * (네이버-blog와 카카오-blog가 동일 'blog', 카카오-web과 Tavily-web이 동일 'web'). 그래서 별도 태그를 둔다.
 *  - 'A' = 무료 표시·단순캐시(≤30분) 전용(네이버·카카오). **LLM 재가공·장기저장(7일 캐시)·수익화 금지.**
 *  - 'B' = 수익화·재가공·저장 허용(위키백과 등 상업 OK 소스). LLM 리포트·7일 캐시·모니터링은 이 레이어만.
 */
export type SourceLayer = 'A' | 'B';

/** 어댑터가 수집해 반환하는 원시 항목(정규화 전). */
export interface RawItem {
  title: string;
  url: string;
  snippet?: string;
  /** 원문 게시 시각(ISO 8601), 있으면 */
  publishedAt?: string;
  /**
   * 항목별 출처 유형 오버라이드. 미지정 시 어댑터의 `sourceType`을 따른다.
   * 한 어댑터가 여러 엔드포인트(예: 네이버 blog/cafe/kin)를 수집할 때
   * 항목마다 정확한 유형 배지(블로그/커뮤니티)를 붙이기 위함(출처 투명성).
   */
  sourceType?: SourceType;
}

export interface CollectContext {
  query: string;
  subjectType?: SubjectType;
  /** 어댑터별 최대 수집 개수 */
  limit?: number;
}

/**
 * 소스별 수집 어댑터. 새 소스는 이 인터페이스 구현 + registry 등록으로 추가한다.
 * (네이버/구글 등 키 필요 소스는 requiresKey=true, isEnabled()로 키 유무 판단)
 */
export interface SourceAdapter {
  readonly id: string;
  readonly sourceType: SourceType;
  /** 라이선스 레이어(ADR-0014). 'A'=표시 전용(네이버·카카오), 'B'=재가공·저장 허용(위키 등 상업 OK). */
  readonly layer: SourceLayer;
  readonly requiresKey: boolean;
  isEnabled(): boolean;
  collect(ctx: CollectContext): Promise<RawItem[]>;
}
