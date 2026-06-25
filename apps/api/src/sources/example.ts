import type { CollectContext, RawItem, SourceAdapter } from './types.js';

function enc(s: string): string {
  return encodeURIComponent(s);
}

/**
 * 파이프라인 검증용 fixture 어댑터 — 네트워크 없이 결정적 데이터를 반환한다.
 * ⚠️ 실제 소스가 아니다. 실데이터는 키 없는 소스(위키백과/위키데이터)부터 어댑터로 추가 예정.
 */
export const exampleAdapter: SourceAdapter = {
  id: 'example',
  sourceType: 'web',
  requiresKey: false,
  isEnabled: () => true,
  collect(ctx: CollectContext): Promise<RawItem[]> {
    const { query, limit = 12 } = ctx;
    const items: RawItem[] = [
      { title: `${query} 공식 소개`, url: `https://example.com/${enc(query)}/about`, snippet: `${query} 제품 서비스 공식 소개` },
      { title: `${query} 제품 라인업`, url: `https://example.com/${enc(query)}/product`, snippet: `${query} 제품 기능 라인업` },
      { title: `${query} 최근 뉴스`, url: `https://example.com/${enc(query)}/news`, snippet: `${query} 뉴스 발표 이슈` },
      { title: `${query} 사용자 리뷰`, url: `https://example.com/${enc(query)}/reviews`, snippet: `${query} 리뷰 평판 사용자` },
      { title: `${query} 공식 채널`, url: `https://example.com/${enc(query)}/channel`, snippet: `${query} 채널 플랫폼 공식` },
    ];
    return Promise.resolve(items.slice(0, limit));
  },
};
