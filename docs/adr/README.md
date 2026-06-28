# ADR — Architecture Decision Records

트레이드오프가 있는 결정을 짧게(5~15줄) 기록한다. 형식: `NNNN-제목.md`.
각 ADR: **맥락 / 결정 / 대안 / 트레이드오프 / 상태**.

| # | 제목 | 상태 |
|---|---|---|
| [0001](./0001-graph-contract-ssot.md) | 그래프 계약은 packages/shared가 SSOT | Accepted |
| [0002](./0002-auth-deferred-to-m2.md) | 인증은 M2로 연기(MVP 익명) | Accepted |
| [0003](./0003-google-curated-domains.md) | 구글 소스는 엄선 도메인(무료 전체웹 종료) | Accepted |
| [0004](./0004-korean-josa-rule-tokenizer.md) | 한국어 조사 분리는 규칙 기반(형태소 분석기 보류) | Accepted |
| [0005](./0005-defer-broad-web-search.md) | 구글 Custom Search 폐기 + 광범위 웹검색 보류 | Accepted |
| [0006](./0006-node-category-palette.md) | 노드 카테고리 팔레트 SSOT 정렬 + concept 색 등록 | Accepted |
| [0007](./0007-social-community-sources.md) | 국내 커뮤니티 소스(네이버/카카오 공식 API) 도입 + SNS 보류 | Accepted |
| [0008](./0008-llm-usage-report.md) | 활용 관점 리포트: 수집 정보를 Claude로 정제해 활용법 제공 | Accepted |
| [0009](./0009-deploy-split-vercel-render.md) | 배포 분리: web=Vercel · api=Render (Supabase 관리형) | Accepted |
| [0010](./0010-bm-broad-first-intent-axis.md) | BM: broad-first + 의도(활용 관점)축 수익화 + 프로슈머 우선 freemium | Accepted |
| [0011](./0011-llm-report-cache-and-licensing-gate.md) | LLM 리포트 2단 캐시(데이터 30분/리포트 7일)+프리웜 + 상업 이용 약관 게이트 | Accepted |
| [0012](./0012-monitoring-alerts.md) | 모니터링/알림: 주제+의도 구독·지문 기반 변화감지·이메일+인앱 (Pro) | Accepted |
| [0013](./0013-llm-budget-circuit-breaker.md) | LLM 예산 자동 상한(서킷 브레이커): 누적 추정비용 상한 도달 시 자동 폴백 | Accepted |
| [0014](./0014-source-license-segmentation.md) | 소스 라이선스 분리: 무료 표시(네이버·카카오) vs 수익화·재가공(상업 OK 소스) | Accepted |
| [0015](./0015-publicdata-corp-source.md) | 공공데이터포털(금융위 기업기본정보) Layer B 소스 도입 — 무료 LLM 리포트 깊이 보강 | Accepted |
| [0016](./0016-multi-endpoint-adapter-helper.md) | 멀티엔드포인트 검색 어댑터 공유 헬퍼 추출 | Accepted |
| [0017](./0017-ratelimiter-token-bucket-burst.md) | 레이트 리미터 캡-버스트 토큰 버킷 (인트라-검색 스태거 제거) | Accepted |
| [0018](./0018-personal-use-mode.md) | 개인 전용 모드: 비공개·비영리 인스턴스에서 Layer A를 LLM 리포트에 재포함 | Accepted |
