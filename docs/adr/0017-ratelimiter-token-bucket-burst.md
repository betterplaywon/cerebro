# ADR-0017 — 레이트 리미터 캡-버스트 토큰 버킷 (인트라-검색 스태거 제거)

- 상태: Accepted
- 일자: 2026-06-28
- 관련: [ADR-0016](./0016-multi-endpoint-adapter-helper.md)(멀티엔드포인트 헬퍼), [ADR-0014](./0014-source-license-segmentation.md)(소스 레이어). 코드: `apps/api/src/lib/rate-limit.ts`, `sources/naver.ts`, `sources/kakao.ts`, `sources/multi-endpoint.ts`. 근거: [security.md](../../.claude/rules/security.md)(rate limit·과도크롤링 금지).

## 맥락
멀티엔드포인트 어댑터(naver 5·kakao 3)는 `collectFromEndpoints`에서 **엔드포인트마다 `await limiter.acquire()`** 후 fetch한다. 종전 `createRateLimiter(minIntervalMs)`는 모든 `acquire()`를 단일 promise 체인에 `minIntervalMs`(120ms) 간격으로 직렬화했다. 그 결과 "병렬"이어야 할 `Promise.allSettled`가 실제로는 **0/120/240/360/480ms로 스태거**되어, naver는 마지막 호출이 +480ms 뒤에 시작했다. `collectAll`은 가장 느린 어댑터를 기다리므로 **캐시-미스 검색마다 ~480ms 순지연**이 더해졌다(휴리스틱/LLM-off 경로에선 수집이 지배적이라 체감 큼).

핵심: 네이버 쿼터는 25,000/일(전 엔드포인트 공유)= 평균 ≈0.29 req/s다. **한 검색 내 5개 호출을 동시에 쏘든 직렬로 쏘든 일일 쿼터 소비는 동일**하다. 즉 인트라-검색 120ms 스태거는 아무것도 보호하지 못하고 지연만 더하는 순수 낭비였다.

## 결정
`createRateLimiter(minIntervalMs, burst = 1)`를 **토큰 버킷**으로 교체한다.
- 용량 `burst` 토큰, **1토큰/`minIntervalMs`로 리필**.
- 토큰이 있으면 대기 0(버스트) → 한 검색의 동시 엔드포인트가 직렬로 줄서지 않는다.
- 토큰이 없으면 1토큰이 찰 때까지만 대기 후 소비 → **지속 호출률 상한은 종전과 동일(1/`minIntervalMs`)**.
- naver/kakao는 `burst = SEARCH_ENDPOINTS.length`(5·3)로 한 검색치 호출만 동시 허용.
- `burst` 기본값 1 = **종전 순차 직렬화와 정확히 동치** → wikipedia(300ms)·publicdata(300ms) 등 단일-엔드포인트 어댑터는 인자 변경 없이 동작·레이트 불변.

## 트레이드오프
- **아웃바운드 타이밍 변경(behavior)**: 사용자 가시 결과(수집 항목·그래프)는 동일하나, 외부 API로의 호출 패턴이 "120ms 직렬"→"검색당 ≤burst 동시 발사 + 지속 상한 유지"로 바뀐다.
  - 순간 동시성 상한 = `burst`(naver 5·kakao 3) — 한 검색치로, 정상적이고 정중한 수준.
  - **지속 평균 레이트는 불변**(1토큰/120ms ≈ 8.3/s)이라 폭주·차단 위험은 추가되지 않는다. security.md의 "rate limit·과도크롤링 금지"를 계속 충족.
- 복잡도: 토큰 회계(리필·차감) 추가(~15줄). 전면 토큰버킷 라이브러리 도입은 YAGNI라 배제 — 기존 체인 직렬화를 재사용한 최소형.

## 대안
- **검색 단위 acquire 1회 + 엔드포인트 `Promise.all`**: 스태거는 제거되나, 동시 검색 N개가 몰리면 각 검색이 burst를 쏴 **지속 레이트가 ×엔드포인트로 폭증**(상한 붕괴) → 차단/쿼터 위험. 기각.
- **유지(직렬 스태거)**: 가장 보수적이나 보호 이득 0의 ~480ms 지연을 영구 부담. 기각.
- **활성 엔드포인트 축소**(naver 5→3): 커버리지 손실. 별개 트래픽-게이트 결정으로 분리(현재 YAGNI).

## 검증
- 단위 테스트: 버스트 즉시 통과(<50ms) + 소진 후 지속 상한 throttle(≥간격) 추가.
- 회귀: naver 어댑터 테스트 지연 ~485ms→~29ms, kakao ~240ms→~16ms로 단축(스태거 제거 확인), 결과 동일.
