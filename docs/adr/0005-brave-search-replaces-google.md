# ADR-0005 — 구글 대신 Brave Search 어댑터 (Custom Search JSON API 신규 고객 차단)

- 상태: Accepted
- 일자: 2026-06-26
- 대체: [ADR-0003](./0003-google-curated-domains.md) (구글 엄선 도메인 방식) — Superseded

## 맥락
ADR-0003에서 "구글 엄선 도메인(≤50) 보조 소스"로 운용하기로 했으나, 실제 키·CSE·프로젝트·API 활성화를 모두 정확히 맞춰도 호출이 **영구 403**으로 막혔다.

원인은 설정 오류가 아니라 **구글 정책**이었다. 구글 공식 문서(Custom Search JSON API Overview)는 다음을 명시한다:

> "The Custom Search JSON API is **closed to new customers**. Vertex AI Search is a favorable alternative for searching up to 50 domains."
> "Existing customers have until **January 1, 2027** to transition."

즉 **신규 프로젝트/조직은 이 API에 접근 자체가 불가**하다. cerebro는 2026년에 새로 만든 프로젝트라 영구 차단 대상이다. 콘솔은 "Enable"을 허용하고 "Enabled"로 표시하지만, 호출 시 백엔드가 `403 PERMISSION_DENIED — "This project does not have the access to Custom Search JSON API"`로 거부한다(설정/대기로 해결 불가).

근거:
- [Custom Search JSON API Overview (공식)](https://developers.google.com/custom-search/v1/overview)
- [Google Developer Forum — 403 on new org / new account restriction](https://discuss.google.dev/t/custom-search-json-api-returns-403-permission-denied-on-new-org-new-account-restriction/347093)

## 결정
구글 Custom Search 어댑터를 **제거**하고, 광범위 웹검색 보조 소스를 **Brave Search(Web Search API)** 로 대체한다.

- **Brave 채택 이유**: 자체 독립 인덱스(구글/빙 재판매 아님), **공식 API**(스크래핑 아님 → ToS 깔끔), 무료 티어(~1 req/s·월 2,000건). cerebro가 구글에 기대했던 "독립 인덱스 광범위 웹검색"을 직접 대체.
- **구현**: `sources/brave.ts`(헤더 인증 `X-Subscription-Token`, `country=KR&search_lang=ko`), registry 등록. SSRF-safe fetch·캐시·폴백·rate-limit 기존 경계 자동 상속. 키 미설정 시 `isEnabled()=false`로 자동 비활성.
- **구글 코드 제거**: `sources/google.ts`/`google.test.ts` 삭제, `env`의 `GOOGLE_API_KEY`/`GOOGLE_CSE_ID` 제거. (영구 사용 불가 → 매 검색마다 헛요청·죽은 코드 방지) `SourceType` enum의 `'google'` 값과 프론트 라벨은 **유지**(과거/캐시 데이터 호환).
- 무료 MVP의 1차 한국어 커버리지는 여전히 **네이버(넓은 한국어)+위키백과**가 담당. Brave는 글로벌/영문·교차검증 보조.

## 트레이드오프 / 대안
- **Brave 한국어 깊이**는 네이버보다 얕다 → 한국어는 네이버 주력 유지, Brave는 보완으로 한정.
- **대안 검토**: ① Vertex AI Search(구글 공식 대안, ≤50 도메인) — GCP Discovery Engine+데이터스토어+과금으로 MVP엔 과함, BM 확장 시 재검토. ② Bing Web Search — MS가 2025 은퇴 발표로 제외. ③ SerpAPI 류 — 구글 스크래핑 재판매라 ToS·비용 부담.
- Brave 무료 티어(월 2,000건) 초과 시 유료 전환 필요 — 캐시(30분)·키 게이트로 비용 통제.
