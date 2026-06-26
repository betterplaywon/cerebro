# cerebro — 현재 상태 & 재개 가이드 (Handoff)

> **새 세션은 이 문서부터 읽으세요.** 어디까지 했고 다음에 뭘 할지의 단일 기준점.
> 최종 갱신: 2026-06-26 · main HEAD 기준(PR #11 머지 시점).

## TL;DR
기반(문서·8에이전트·모노레포·CI)과 **M1 하이브리드 검색**까지 완료·머지됨. `/api/search`가 **위키백과+네이버**의 실제 공개정보를 수집·정제해 중심-가지 그래프로 반환하고, 프론트(Vite+R3F)가 3D 마인드맵으로 그린다. **구글 어댑터는 코드·키 설정 완료**, 단 구글 측 Custom Search API **반영 지연(403)** 으로 결과 미합류 상태 → 새 세션에서 재검증 필요(아래 명령).

---

## 1. 지금 동작하는 것
- **검색 → 세레브로 로딩 → 3D 마인드맵 → 노드 상세(출처·신뢰도·활용법)** 핵심 루프 동작.
- **출처 투명성**: 그래프 하단 "분석된 출처 N건" + 유형별 한글 배지(네이버·위키백과…), 상세 패널 출처 유형 한글 표기.
- 하이브리드 수집(병렬, 일부 실패 허용) + 캐시(30분) + 빈약 시 mock 폴백.
- 라이브 검증됨: `"토스"` → 출처 19건(**위키 8 + 네이버 11**), 재요청 `cached=true`.

### 소스 어댑터 상태
| 어댑터 | 상태 | 비고 |
|---|---|---|
| `wikipedia` | ✅ 동작 | 키 불필요 (ko.wikipedia REST) |
| `naver` | ✅ 동작 | `.env`에 키 입력됨(로컬). webkr+news, 헤더 인증 |
| `google` | ⏳ 보류 | 키·CSE 설정 완료. **구글 반영 지연으로 403** → 재검증 대기. 엄선 도메인 방식(ADR-0003) |

## 2. 아키텍처 빠른 지도
```
apps/api (Fastify)
  src/server.ts            POST /api/search (zod 검증·캐시·폴백·계약보증), GET /health
  src/collect/             normalize · dedup · score(토픽) · orchestrator(allSettled)
  src/sources/             types · registry · wikipedia · naver · google · example(테스트 fixture)
  src/graph/build.ts       수집→GraphSnapshot(중심+토픽)
  src/lib/                 http(SSRF-safe fetch) · rate-limit · cache(TTL+LRU) · text(stripHtml)
  src/env.ts               zod 환경검증(옵셔널 키=빈값→비활성)
packages/shared            zod 계약 SSOT (Graph/Source/Subject/Search 스키마)  ← 계약 변경은 여기 먼저
apps/web (Vite+React+R3F)  검색 UI · 세레브로 로더(CSS) · MindMapCanvas(lazy) · DetailPanel · SourceSummary(출처 요약) · api/client
```
- **새 소스 추가법**: `sources/`에 `SourceAdapter` 구현 + `registry.ts` 등록 → SSRF·캐시·폴백 자동 상속. 키 필요 시 `isEnabled()`로 게이트.

## 3. 로컬 실행 / 검증
```bash
pnpm install
pnpm dev                 # web :5173 + api :8787
pnpm typecheck && pnpm test && pnpm lint && pnpm build   # 전체 게이트 (현재 그린, 테스트 45개)
```
- 키는 `apps/api/.env`(**gitignore됨**, 커밋 금지)에 있음: 네이버(작동) + 구글(반영 대기). 값은 절대 출력/커밋 금지.

## 4. 🔴 새 세션 첫 작업 — 구글 3-소스 재검증
구글 Custom Search API 반영(최초 활성화는 길게 ~1시간)이 끝났는지 먼저 확인:
```bash
cd /Users/kang/Desktop/cerebro
set -a; . apps/api/.env; set +a
curl -s "https://www.googleapis.com/customsearch/v1?key=$GOOGLE_API_KEY&cx=$GOOGLE_CSE_ID&q=%ED%86%A0%EC%8A%A4&hl=ko&num=3" \
 | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ERROR" if "error" in d else "OK", d.get("error",{}).get("message", d.get("searchInformation",{})))'
```
- **OK(200)** 이면: 코드 변경 없이 이미 합류함. 서버 띄워 `/api/search`로 `by_type`에 `google` 확인하면 끝.
- **`This project does not have the access to Custom Search JSON API`** (2026-06-26 재검증 시 관측): 단순 반영 지연이 아니라 **Cloud 프로젝트에 Custom Search API가 미활성** 상태. → **사용자 액션 필요**: [Google Cloud Console](https://console.cloud.google.com/apis/library/customsearch.googleapis.com)에서 해당 프로젝트의 **"Custom Search API" 사용 설정(Enable)** 후 몇 분 뒤 위 curl 재실행. (무료 100/일은 과금 없음. 필요 시 결제 계정 연결도 확인.)
- **여전히 403**: 활성화 직후면 몇 분 더 대기 후 재시도.
- (값 노출 금지: 키는 env에서 읽어 쓰되 출력하지 말 것.)

## 5. 다음 작업 백로그 (우선순위)
1. **구글 3-소스 검증 마무리** (위 §4) — ⏳ Cloud Console에서 Custom Search API 활성화(사용자 액션) 대기.
2. ~~**출처 표시 UX**(무키·안전): "분석된 출처 N건" 요약 + 출처 타입 한글 배지.~~ ✅ 완료(PR `feat/source-summary-ux`): 그래프 하단 `SourceSummary`(분석된 출처 N건 + 유형별 한글 배지) + 상세 패널 출처 유형 한글화. 부수로 출처 URL을 http(s) 스킴으로 제한(계약+수집 경계, XSS 방지).
3. **한국어 토큰화 개선**: 조사 분리('대한민국의'→'대한민국'). ⚠️ 단순 규칙은 오탐('음악가'→'음악') 위험 → 가벼운 형태소 라이브러리 도입 트레이드오프 검토 후(ADR로).
4. **노드 카테고리 분류**: 제품/뉴스/인물/채널/평판 색 구분(DESIGN-SYSTEM 팔레트).
5. **프론트 실데이터 시각 검증**(web+api 띄워 확인) + 모바일 폴백 점검.
6. ROADMAP의 M1 잔여 항목.

## 6. 알려진 한계
- 한국어 토큰화 naive(조사 미분리) — 토픽에 노이즈 일부.
- 구글은 **엄선 도메인(≤50)** 만(무료 전체웹 종료, ADR-0003). CSE에 도메인 추가로 커버리지 조정.
- 그래프 토픽 = 키워드 빈도 기반(엔티티 해석 고도화는 후속).

## 7. 운영 규칙 (필수)
- 작업 단위 브랜치(`<type>/<설명>`) → 원자적 커밋 → PR → **CI 그린이면 squash 머지+브랜치 삭제**.
- 금지: `git reset`/`git push --force`/`eval`/조건없는 DROP 등([.claude/rules/security.md]). 시크릿·민감 개인정보 노출 금지(PIPA).
- 상세: [CLAUDE.md](../CLAUDE.md) · [FOUNDATION-SPEC](./foundation/FOUNDATION-SPEC.md) · [ADR](./adr/).

## 8. 머지된 PR (이력)
#1 기반·체계 · #2~5 Dependabot · #6 웹 코드분할 · #7 수집 골격 · #8 위키 어댑터 · #9 그래프 품질 · #10 네이버·구글 어댑터 · #11 구글 엄선도메인 ADR.
