# ADR-0021 — OG/SEO 티어링: 정적 기본기(지금) + 검색별 OG·결과 페이지(M2)

- 상태: Accepted (오너 요청 — "OG 태그/이미지, SEO 필요 여부 논의")
- 일자: 2026-06-28
- 대상: `apps/web` 메타/소셜/색인 자산. 바이럴 엔진(검색별 OG·공유 기능)은 범위 밖(M2로 분리).

## 맥락
cerebro는 순수 클라이언트 렌더 SPA(Vite)다. `index.html`엔 `title`+`description`만 있었고 OG·트위터카드·favicon·robots·canonical·sitemap이 전무했다. 검색은 `?q=`로 딥링크 재현은 되나 공유 버튼/공유 이미지/결과 페이지는 미구현이다.

핵심 기술 전제: **소셜 크롤러(카카오·X·페이스북·슬랙)와 구글 초기 크롤은 JS를 실행하지 않고 원본 HTML만 읽는다.**
- 정적 OG를 `index.html`에 박으면 **모든 URL이 동일한 카드 1장**이 된다(검색어별 카드 불가).
- 검색별 OG 카드(= 바이럴 핵심)는 **URL별 메타를 서버가 렌더**해야 한다(엣지/프리렌더). 클라이언트 주입(react-helmet)은 크롤러에 안 통한다.
- 게다가 본체인 3D는 SEO 대상이 아니다 — SEO가 먹는 건 텍스트 폴백 결과 페이지뿐.

GTM(§3.2·§4)은 이미 "공유 이미지(OG 썸네일) + `/g/:slug` 결과 페이지 = 바이럴 엔진 + SEO 자산"을 전략으로 못박았고, ROADMAP은 **공유/계정을 M2**로 둔다(현재 M1).

## 결정
가치를 **티어로 분리**해, 마일스톤·비용에 맞춰 단계 적용한다.

### Tier 0 — 정적 기본기 (이 ADR에서 구현, M1)
- favicon: `favicon.svg`(벡터) + `favicon-32.png` + `apple-touch-icon.png`(180). 브랜드 마크 = 발광 코어 + 위성 노드(중심-가지 모티프).
- 정적 OG/트위터 카드(브랜드 1장): `og:type/site_name/locale(ko_KR)/title/description/url/image(+width·height·alt)`, `twitter:card=summary_large_image`.
- OG 이미지 `og-cover.png`(1200×630): 워드마크 + 태그라인 + 마인드맵 모티프(다크 시네마틱).
- `robots.txt`(allow), `canonical`, `theme-color`.
- 절대 URL은 도메인 하드코딩 없이 **빌드 env 주입**: `index.html`의 `%SITE_URL%`을 vite 플러그인이 `VITE_PUBLIC_SITE_URL` → Vercel 프로덕션 URL → `''`(루트 상대) 순으로 치환.

### Tier 1 — 검색별 OG + 결과 페이지 (M2, 별도 작업)
- Vercel 엣지 미들웨어가 **봇 요청 시** URL별 OG 메타 + `@vercel/og`(satori+resvg) 동적 카드(중심 라벨·카테고리·워터마크) 반환.
- 크롤용 텍스트 폴백(노드 요약·출처)을 서버 렌더 → 구글 색인(3D는 향상 레이어).
- 공유 단위/URL(`?q=` 유지 또는 `/g/:slug`), 공유 버튼·계측(K-factor)과 한 묶음.
- PIPA 게이트(GTM §4.2): 공개정보·출처만, **공인 외 개인 그래프는 OG/공유 비활성**.

### Tier 2 — 전면 SSR/SSG(Next.js 이전): 기각(YAGNI). Tier 1 엣지 방식이 재작성 없이 가치의 ~90%.

## 대안
- **지금 Tier 1까지**: 바이럴 ROI는 높으나 아직 없는 공유 버튼/플로우/계측에 의존 → 반쪽. M1의 DELETION-RIGHTS(M1 Exit④)보다 우선할 근거 부족. 기각(M2로).
- **아무것도 안 함**: favicon 부재·빈 공유 미리보기로 미완성 인상. 기각.
- **도메인 하드코딩**: 공개 마케팅 URL은 시크릿이 아니라 무방하나, 도메인 미확정 + 레포 자세상 빌드 env 주입이 더 깔끔. 기각.
- **SVG를 OG 이미지로**: 트위터 미지원·카카오 비신뢰. 래스터(PNG) 필수. 기각.

## 트레이드오프
- (+) 홈 링크 공유가 프로페셔널해지고 기본 색인 가능. 저위험·마일스톤 무관·런타임 의존성 0.
- (+) 절대 URL을 env로 주입 → 도메인 비종속, 프리뷰/프로덕션 자동 대응.
- (−) Tier 0는 **모든 URL이 동일 카드** — 검색별 카드는 Tier 1 전까지 불가(SPA의 정직한 천장).
- (−) OG 이미지가 **빌드 산출물(PNG)을 커밋**하는 형태 → SVG 수정 시 재생성 필요(아래 절차). 영구 의존성을 피하려는 의도된 절충.
- (−) 프로덕션은 `VITE_PUBLIC_SITE_URL`(또는 Vercel 자동 URL)이 있어야 절대 OG가 완성됨 — 없으면 루트 상대로 degrade.

## 영향 / 운영
- `apps/web/index.html`(메타), `apps/web/vite.config.ts`(`%SITE_URL%` 주입 플러그인), `apps/web/public/`(favicon·og·robots 자산), 루트 `.env.example`·`docs/DEPLOYMENT.md`(`VITE_PUBLIC_SITE_URL`).
- **OG/파비콘 재생성 절차**(래스터라이저는 레포 미포함 — 일회성 도구로 생성):
  1. `apps/web/branding/og-cover.svg`(OG 소스) 또는 `apps/web/public/favicon.svg` 수정.
  2. 임시 디렉터리에서 `npm i @resvg/resvg-js` 후, SVG를 `fitTo width`로 렌더해 `og-cover.png`(1200)·`favicon-32.png`(32)·`apple-touch-icon.png`(180)로 저장(`loadSystemFonts: true`).
  3. 생성된 PNG를 `apps/web/public/`에 커밋.
- 검증: 배포 후 [OG 디버거](https://developers.facebook.com/tools/debug/)·카카오/X 미리보기로 카드 확인.
