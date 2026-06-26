# ADR-0006 — 노드 카테고리 팔레트 SSOT 정렬 + concept 색 신규 등록

- 상태: Accepted
- 일자: 2026-06-26

## 맥락
실데이터 그래프의 가지를 카테고리(제품/뉴스/평판/채널/인물)로 분류(ADR 없음, 백엔드 PR)하면서
프론트가 카테고리별 색을 입혀야 한다. 그런데 `apps/web/src/lib/colors.ts`의 `NODE_COLORS`가
DESIGN-SYSTEM §1.4의 카테고리 HEX와 **불일치**했고(8개 중 6개 상이), 특히 채널/평판 색이 사실상
**뒤바뀐** 상태였다. 또 `concept`(관련 개념) 색은 DESIGN-SYSTEM에 **정의가 없었다**.

## 결정
**DESIGN-SYSTEM §1.4를 SSOT로 삼아 `NODE_COLORS`를 1:1 정렬**한다. `colors.ts`가 2D/3D 공용 JS SSOT가
되고, **패리티 테스트**(`colors.test.ts`)로 표류를 막는다.
- center `#37E0D8` · product `#5BD1FF` · news `#F2B847` · person `#A98BFF` · **channel `#FF8FB1`(핑크)** ·
  **reputation `#3FD68A`(초록)** · attribute `#8A93A8`.
- **channel/reputation 의미 교정(swap)**: 이전 코드는 채널=청록/평판=핑크였으나 SSOT 기준으로 채널=핑크/평판=초록으로 바로잡는다.
- **concept `#8AA0FF` 신규 등록**: SSOT 미정의였으므로 person(보라 `#A98BFF`)과 구분되는 청보라로 추가하고 DESIGN-SYSTEM §1.4에 행을 신설.
- **색 단독 식별 금지(WCAG AA)**: 3D 구체에는 텍스트 라벨이 없으므로 **카테고리 범례(색+아이콘+라벨)** 오버레이와
  상세 패널 **카테고리 배지(아이콘+색+라벨)** 를 추가한다. 아이콘은 의존성 없이 인라인 SVG(형태로 구분 → 색맹 대응).

## 대안
- **코드 HEX를 SSOT로 (문서를 코드에 맞춤)**: 디자인 토큰의 권위를 코드에 종속 → 거부. 문서가 SSOT(§13.3).
- **lucide-react 등 아이콘 라이브러리 도입**: 트리셰이킹 가능하나 카테고리 ~7개 아이콘에 새 의존성은 과함(YAGNI) → 인라인 SVG.
- **concept를 person과 동일 계열 유지(#9AA7FF)**: person과 인접해 혼동 → 청보라로 분리 + 아이콘으로 이중 구분.

## 트레이드오프
- **장점**: 디자인-구현 색 정합 회복, 패리티 테스트로 회귀 차단, 색맹·저대비 환경에서도 아이콘+라벨로 식별, 의존성 0.
- **비용/한계**: 평판(`#3FD68A`)=success, 뉴스(`#F2B847`)=warning과 **색상 충돌**은 SSOT가 의도한 것 — 의미색과 카테고리색이
  같은 화면에 동시에 오면 색만으론 모호하나 **아이콘+라벨**이 1차 식별 단서라 허용. 3D 노드 자체의 인캔버스 라벨/키보드 내비게이션은
  별도 후속(이 PR 범위 밖). 카테고리 한국어 라벨이 web/api 양쪽에 존재(중복) — 3번째 사용 시 `packages/shared`로 승격.

## 참고
- 구현: `apps/web/src/lib/colors.ts`, `components/CategoryLegend.tsx`, `components/CategoryIcon.tsx`, `components/DetailPanel.tsx`
- 테스트: `apps/web/src/lib/colors.test.ts` (패리티)
- 분류기(백엔드): `apps/api/src/graph/category-rules.ts` (PR #17)
