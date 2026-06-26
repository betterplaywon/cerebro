import type { SourceAdapter } from './types.js';
import { wikipediaAdapter } from './wikipedia.js';
import { naverAdapter } from './naver.js';
import { kakaoAdapter } from './kakao.js';

/**
 * 등록된 모든 어댑터. 새 소스는 여기에 추가한다.
 * 키 필요 어댑터(naver/kakao)는 키 미설정 시 isEnabled()=false 로 자동 제외된다.
 * 국내 커뮤니티 커버리지는 공식 검색 API(네이버 blog/cafe/kin + 카카오 web/blog/cafe)로 확보 —
 * 커뮤니티 직접 크롤링은 ToS·robots·인증벽 위반이라 금지(ADR-0007).
 * 광범위 웹검색(구글→Brave/Tavily)은 보류 — 무료 티어 축소로 MVP엔 부적합(ADR-0005).
 * SNS(X·인스타·페북)는 공식 API 부재·유료·승인 게이트로 보류(ADR-0007).
 * (example 어댑터는 테스트 fixture 전용 — 프로덕션 레지스트리에 넣지 않는다)
 */
const ADAPTERS: readonly SourceAdapter[] = [wikipediaAdapter, naverAdapter, kakaoAdapter];

export function getAllAdapters(): readonly SourceAdapter[] {
  return ADAPTERS;
}

/** 현재 사용 가능한(키 보유 등) 어댑터만. */
export function getEnabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.isEnabled());
}
