# ADR-0016 — 멀티엔드포인트 검색 어댑터 공유 헬퍼 추출

- 상태: Accepted
- 일자: 2026-06-28
- 관련: [ADR-0007](./0007-social-community-sources.md)(국내 커뮤니티 공식 API), [ADR-0014](./0014-source-license-segmentation.md)(소스 레이어). 코드: `apps/api/src/sources/multi-endpoint.ts`.

## 맥락
네이버·카카오 어댑터는 둘 다 **여러 검색 엔드포인트를 병렬 수집**하는 동일 구조다
(naver: webkr/news/blog/cafe/kin, kakao: web/blog/cafe). 두 `collect` 구현이
`Promise.allSettled(endpoints.map(acquire→buildUrl→fetchJson→map(toRawItem).filter))→flatMap`
골격과 `toRawItem` 가드(url/title 존재 → `new URL` → stripHtml 빈 제목 → null)를 **line-for-line 복붙**했다
(naver.ts 주석이 "kakao와 동일 가드"로 자인). 차이는 host·인증헤더·URL 템플릿·파라미터명·봉투키·필드명뿐.

## 결정
공유 헬퍼 2개를 `sources/multi-endpoint.ts`로 추출한다.
- `collectFromEndpoints(config)` — rate-limit 직렬화 + allSettled 병렬 + 매핑/필터/flatMap 골격.
  어댑터별 차이는 config(endpoints·buildUrl·schema·extractItems·toRawItem·headers·limiter)로 주입.
- `buildRawItem(draft)` — 외부 url/title 가드(누락·잘못된 URL·stripHtml 빈 제목 → null) 단일화.
  신뢰불가 외부 입력을 받는 어댑터의 **보안 가드를 한 곳**으로 모아 드리프트를 막는다.

## 트레이드오프 (rule-of-3 경계)
- 코딩표준은 "추상화는 3번째 중복에서"인데 멀티엔드포인트 어댑터는 **현재 2개**다.
  그럼에도 추출하는 이유: ① 유사가 아니라 **정확한 복붙**(자인) ② 가드가 **보안 관련**이라
  한쪽만 고치면 드리프트 위험 ③ config가 동작이 아닌 **데이터 위주**라 간접화 비용이 낮다.
- 비용: config 객체라는 간접 계층 1개. 한 소스가 크게 갈라지면(예: 커서 페이지네이션) config로
  흡수가 어려워질 수 있으나, 그때 해당 어댑터만 인라인으로 되돌리면 된다(되돌리기 쉬움).

## 대안
- **유지(복붙)**: rule-of-3 엄격 준수. 그러나 보안 가드 드리프트 위험 + 자인된 복붙 방치라 기각.
- **`createMultiEndpointAdapter` 풀 팩토리**: 어댑터 전체를 config화. 2개엔 과추상화(각 어댑터의
  정체성·가독성 상실, 갈라지기 어려움)라 기각 — 헬퍼 공유가 가독성/유연성 균형점.
- **단일 엔드포인트 어댑터(wiki·publicdata)까지 통합**: 구조가 다름(자체 URL 구성, 단건 best-match)
  이라 부적합 — 헬퍼는 멀티엔드포인트 2개에만 적용한다.
