# cerebro — 현재 상태 & 재개 가이드 (Handoff)

> **새 세션은 이 문서부터 읽으세요.** 어디까지 했고 다음에 뭘 할지의 단일 기준점.
> 최종 갱신: 2026-06-26 · 구글 JSON API 신규고객 영구차단 확인 → **Brave 어댑터로 대체**(ADR-0005, 브랜치 `feat/brave-search-adapter`).

## TL;DR
기반(문서·8에이전트·모노레포·CI)과 **M1 하이브리드 검색**까지 완료·머지됨. `/api/search`가 **위키백과+네이버**의 실제 공개정보를 수집·정제해 중심-가지 그래프로 반환하고, 프론트(Vite+R3F)가 3D 마인드맵으로 그린다. **구글 Custom Search JSON API는 신규 고객에 영구 차단됨**(공식 — 콘솔은 Enabled여도 호출 시 403, 설정/대기로 해결 불가). 어댑터를 제거하고 **Brave Search 어댑터로 대체**(ADR-0005). Brave는 `BRAVE_SEARCH_API_KEY`를 `.env`에 넣으면 자동 활성(§4).

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
| `brave` | ⏳ 키 대기 | 코드·테스트 완료. `BRAVE_SEARCH_API_KEY` 입력 시 자동 활성. 구글 대체(ADR-0005). 헤더 인증(`X-Subscription-Token`) |
| ~~`google`~~ | ❌ 제거 | Custom Search JSON API **신규 고객 영구 차단**(공식). 어댑터 삭제(ADR-0005가 ADR-0003 대체) |

## 2. 아키텍처 빠른 지도
```
apps/api (Fastify)
  src/server.ts            POST /api/search (zod 검증·캐시·폴백·계약보증), GET /health
  src/collect/             normalize · dedup · score(토픽) · orchestrator(allSettled)
  src/sources/             types · registry · wikipedia · naver · brave · example(테스트 fixture)
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
pnpm typecheck && pnpm test && pnpm lint && pnpm build   # 전체 게이트 (현재 그린, 테스트 150+개)
```
- 키는 `apps/api/.env`(**gitignore됨**, 커밋 금지)에 있음: 네이버(작동). Brave 키(`BRAVE_SEARCH_API_KEY`)는 발급 후 추가하면 자동 활성. 값은 절대 출력/커밋 금지.

## 4. 🟢 Brave 키 발급 → 3-소스(위키+네이버+brave) 활성화
> 구글은 끝났다(신규 고객 영구 차단, TL;DR/ADR-0005). 광범위 웹검색은 **Brave Search**로 대체됨 — 키만 넣으면 자동 활성.

1. https://brave.com/search/api 가입 → **무료 플랜**(월 2,000건) 선택 → API 키 발급.
2. `apps/api/.env`에 `BRAVE_SEARCH_API_KEY=<발급키>` 추가(**커밋 금지**).
3. 서버 띄워 `graph.sources`에 `brave` 출처가 합류하는지 확인:
```bash
cd /Users/kang/Desktop/cerebro
pnpm --filter api dev   # :8787 (별도 터미널)
curl -s localhost:8787/api/search -X POST -H 'content-type: application/json' -d '{"query":"토스"}' \
 | python3 -c 'import sys,json,collections; d=json.load(sys.stdin); print(collections.Counter(s["type"] for s in d["graph"]["sources"]))'
```
- 출력에 `'brave': N` 이 보이면 합류 성공. 화면 하단 출처 요약에 **"브레이브"** 배지도 뜬다.
- **키 미설정이면** brave는 `isEnabled()=false`로 자동 제외(위키+네이버만 동작) — 에러 아님, MVP는 그대로 동작.
- (값 노출 금지: 키는 `.env`에서만, 출력/커밋 금지.)

## 5. 다음 작업 백로그 (우선순위)
1. **Brave 키 발급 → 3-소스 활성화** (위 §4) — ⏳ brave.com/search/api 키 발급(사용자 액션) 후 `.env` 추가. ~~구글~~ 폐기(ADR-0005).
2. ~~**출처 표시 UX**(무키·안전): "분석된 출처 N건" 요약 + 출처 타입 한글 배지.~~ ✅ 완료(PR `feat/source-summary-ux`): 그래프 하단 `SourceSummary`(분석된 출처 N건 + 유형별 한글 배지) + 상세 패널 출처 유형 한글화. 부수로 출처 URL을 http(s) 스킴으로 제한(계약+수집 경계, XSS 방지).
3. ~~**한국어 토큰화 개선**: 조사 분리('대한민국의'→'대한민국').~~ ✅ 완료(`feat/korean-josa-tokenizer`, ADR-0004): 받침(종성) 이형태 규칙 기반 `stripParticle`(의존성 0). 받침+최소길이+보호사전으로 오탐('음악가'→'음악') 차단. 형태소 라이브러리(kiwi-nlp)는 보류. 코퍼스 테스트(`korean.test.ts`) 고정.
4. **노드 카테고리 분류**: 제품/뉴스/인물/채널/평판 색 구분(DESIGN-SYSTEM 팔레트).
5. **프론트 실데이터 시각 검증**(web+api 띄워 확인) + 모바일 폴백 점검.
6. ROADMAP의 M1 잔여 항목.

## 6. 알려진 한계
- 한국어 토큰화: 조사 분리는 규칙 기반(ADR-0004)으로 개선됨. 잔여 한계 — 보호 단어 사전은 비완전(신규 `~家`/`~이`/`주의`어 오탐 가능), 복합명사 분해·품사 필터 없음(필요 시 kiwi-nlp 재검토).
- 광범위 웹검색 = **Brave**(독립 인덱스, 무료 월 2,000건). 한국어 깊이는 네이버 주력, Brave는 글로벌/교차검증 보조(ADR-0005). 구글 JSON API는 신규 고객 차단으로 폐기.
- 그래프 토픽 = 키워드 빈도 기반(엔티티 해석 고도화는 후속).

## 7. 운영 규칙 (필수)
- 작업 단위 브랜치(`<type>/<설명>`) → 원자적 커밋 → PR → **CI 그린이면 squash 머지+브랜치 삭제**.
- 금지: `git reset`/`git push --force`/`eval`/조건없는 DROP 등([.claude/rules/security.md]). 시크릿·민감 개인정보 노출 금지(PIPA).
- 상세: [CLAUDE.md](../CLAUDE.md) · [FOUNDATION-SPEC](./foundation/FOUNDATION-SPEC.md) · [ADR](./adr/).

## 8. 머지된 PR (이력)
#1 기반·체계 · #2~5 Dependabot · #6 웹 코드분할 · #7 수집 골격 · #8 위키 어댑터 · #9 그래프 품질 · #10 네이버·구글 어댑터 · #11 구글 엄선도메인 ADR.
