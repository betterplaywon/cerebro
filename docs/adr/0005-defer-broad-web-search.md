# ADR-0005 — 구글 Custom Search 폐기 + 광범위 웹검색 보류 (무료 티어 멸종)

- 상태: Accepted
- 일자: 2026-06-26
- 대체: [ADR-0003](./0003-google-curated-domains.md) (구글 엄선 도메인 방식) — Superseded

## 맥락
ADR-0003에서 "구글 엄선 도메인(≤50) 보조 소스"로 운용하려 했으나, 키·CSE·프로젝트·API 활성화를 모두 정확히 맞춰도 호출이 **영구 403**으로 막혔다.

원인은 설정 오류가 아니라 **구글 정책**이었다. 공식 문서(Custom Search JSON API Overview)가 명시한다:

> "The Custom Search JSON API is **closed to new customers**. ... Existing customers have until **January 1, 2027** to transition."

즉 cerebro(2026년 신규 프로젝트)는 이 API에 **접근 자체가 불가**하다. 콘솔은 "Enable"을 허용하고 "Enabled"로 표시하지만, 호출 시 백엔드가 `403 PERMISSION_DENIED — "This project does not have the access to Custom Search JSON API"`로 막는다(설정/대기로 해결 불가).

근거: [Custom Search JSON API Overview (공식)](https://developers.google.com/custom-search/v1/overview)

## 검토한 대안 (2026-06)
대체 웹검색 API를 찾았으나, **무료 웹검색 API 시장 자체가 빠르게 유료화**되는 중이었다.

| 대안 | 상태 |
|---|---|
| **Tavily** | 월 1,000건 진짜 무료(이후 $0.008/건). AI 검색 특화. 재도입 시 1순위 후보. |
| Brave Search API | 인덱스·API 품질은 좋으나 **2026-02 무료 티어 폐지** → 월 $5 크레딧(~1,000건) + **카드 등록 필수** + 초과 시 상한없이 과금. |
| Google Vertex AI Search | 구글 공식 대안(≤50 도메인). Discovery Engine+데이터스토어+과금 → MVP엔 과함. |
| Bing Web Search | MS가 2025 은퇴 발표 → 제외. |
| SearXNG(자체호스팅) | 키·요금 0이나 VPS·CAPTCHA·상업적 회색지대 → 공개 서비스 MVP 부적합. |
| SerpAPI 류 | 구글 결과 스크래핑 재판매 → ToS·비용 부담. |

> 참고: Brave 어댑터를 한 번 구현·머지(#15)했다가, 그 직후 Brave 무료 폐지를 확인하고 본 ADR로 **보류 결정** → 제거(이 PR).

## 결정
**광범위 웹검색 소스를 지금은 도입하지 않는다.** 구글 어댑터를 제거하고, 검색 소스는 **네이버(넓은 한국어) + 위키백과** 2개로 출시한다.

- 광범위 웹검색은 어디까지나 **보조** 소스다. 보조 하나를 위해 MVP 단계부터 **신용카드 등록·과금 리스크·추가 의존성**을 떠안는 것은 YAGNI 위반.
- 네이버가 한국어 커버리지의 주력이고, 위키백과가 백과 사실을 받친다 — 핵심 가치(중심-가지 마인드맵)는 이 2개로 충분히 성립.
- **재도입 트리거**: 실제 트래픽/사용자 피드백으로 "광범위 웹검색이 정말 필요"가 확인되면 그때 도입. 그 시점 1순위는 **Tavily**(무료 1,000건), 차선 Brave 유료.
- 어댑터 추상화(`SourceAdapter`) 덕분에 소스 추가/제거는 파일 1개 단위 → 재도입 비용이 낮다(보류의 기회비용이 작다).

## 트레이드오프
- (-) 영문/글로벌 웹·교차검증 커버리지가 당장은 네이버+위키로 제한된다.
- (+) 비용 0, 카드 0, 외부 의존성 최소 → 무료 운영 원칙 유지, 출시 단순화.
- (+) 시장이 더 출렁여도(또 어떤 API가 닫혀도) 영향 없음. 진짜 필요할 때 최신 무료 옵션으로 들어가면 된다.
