# cerebro — 현재 상태 & 재개 가이드 (Handoff)

> **새 세션은 이 문서부터 읽으세요.** 어디까지 했고 다음에 뭘 할지의 단일 기준점.
> 최종 갱신: 2026-06-26 · 구글 JSON API 신규고객 영구차단 + 무료 웹검색 API 유료화 → **광범위 웹검색 보류, 네이버+위키 2소스로 출시**(ADR-0005).
> · 소셜/커뮤니티 검증 → **국내 커뮤니티(네이버 blog/cafe/kin + 카카오 web/blog/cafe) 공식 API로 도입, SNS(X·인스타·페북) 보류**(ADR-0006).

## TL;DR
기반(문서·8에이전트·모노레포·CI)과 **M1 하이브리드 검색**까지 완료·머지됨. `/api/search`가 **위키백과+네이버**의 실제 공개정보를 수집·정제해 중심-가지 그래프로 반환하고, 프론트(Vite+R3F)가 3D 마인드맵으로 그린다. **구글 Custom Search JSON API는 신규 고객에 영구 차단됨**(공식 — 콘솔은 Enabled여도 호출 시 403). 대체로 검토한 **Brave도 2026-02 무료 폐지(카드 필수)**, Tavily만 무료 1,000건 남음. 보조 웹검색에 카드·과금을 떠안는 건 YAGNI → **지금은 광범위 웹검색을 보류하고 네이버+위키 2소스로 출시**(ADR-0005). 재도입은 트래픽 확인 후(1순위 Tavily).

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
| `naver` | ✅ 동작 | `.env`에 키 입력됨(로컬). webkr+news+**blog+cafe+kin**(헤더 인증). 일일 25k콜 전 엔드포인트 공유 |
| `kakao` | ⏸️ 키대기 | 다음 web/blog/cafe — 국내 커뮤니티 색인 보완(ADR-0006). `KAKAO_REST_API_KEY` 입력 시 자동 활성 |
| 광범위 웹검색 | ⏸️ 보류 | 구글=신규고객 영구차단(공식), Brave=2026-02 무료폐지(카드필수). 재도입 1순위 Tavily(무료 1k). ADR-0005(0003 대체) |
| SNS(X·인스타·페북) | ⏸️/❌ 보류 | X=유료(읽기 $0.005/post, ~$30~100/월), 인스타=법인 Business Verification+앱심사, 페북=공개글 키워드 검색 API 부재. ADR-0006 |

## 2. 아키텍처 빠른 지도
```
apps/api (Fastify)
  src/server.ts            POST /api/search (zod 검증·캐시·폴백·계약보증), GET /health
  src/collect/             normalize · dedup · score(토픽) · pii(민감정보 마스킹) · orchestrator(allSettled)
  src/sources/             types(RawItem.sourceType 오버라이드) · registry · wikipedia · naver(webkr/news/blog/cafe/kin) · kakao(web/blog/cafe) · example(테스트 fixture)
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
- 키는 `apps/api/.env`(**gitignore됨**, 커밋 금지)에 있음: 네이버(작동). 값은 절대 출력/커밋 금지.

## 4. 🟢 현재 출시 구성 = 네이버 + 위키백과 (웹검색 보류)
> 광범위 웹검색은 보류했다(무료 티어 멸종, ADR-0005). 구글=영구차단, Brave=2026-02 무료폐지+카드필수, Tavily만 무료 1k. 핵심 루프(중심-가지 마인드맵)는 네이버+위키 2소스로 충분히 성립한다.

동작 확인 (현재 출처가 wikipedia/naver 인지):
```bash
cd /Users/kang/Desktop/cerebro
pnpm --filter api dev   # :8787 (별도 터미널)
curl -s localhost:8787/api/search -X POST -H 'content-type: application/json' -d '{"query":"토스"}' \
 | python3 -c 'import sys,json,collections; d=json.load(sys.stdin); print(collections.Counter(s["type"] for s in d["graph"]["sources"]))'
```
→ `wikipedia`, `naver` 가 보이면 정상.

**웹검색 재도입(트래픽 생긴 뒤)**: 1순위 **Tavily**(무료 1,000건/월), 차선 Brave 유료. `SourceAdapter` 구현 + `registry` 등록이면 끝(파일 1개). ADR-0005 참조. (참고: Brave 어댑터를 #15로 만들었다가 무료 폐지 확인 후 제거 — git 히스토리에 코드 남아있어 재도입 쉬움.)

## 5. 다음 작업 백로그 (우선순위)
1. ~~구글/Brave 광범위 웹검색~~ → **보류**(ADR-0005, 무료 티어 멸종). 핵심 루프는 네이버+위키로 출시. 재도입은 트래픽 확인 후 Tavily 우선 → 실질 다음 작업은 ④⑤.
2. ~~**출처 표시 UX**(무키·안전): "분석된 출처 N건" 요약 + 출처 타입 한글 배지.~~ ✅ 완료(PR `feat/source-summary-ux`): 그래프 하단 `SourceSummary`(분석된 출처 N건 + 유형별 한글 배지) + 상세 패널 출처 유형 한글화. 부수로 출처 URL을 http(s) 스킴으로 제한(계약+수집 경계, XSS 방지).
3. ~~**한국어 토큰화 개선**: 조사 분리('대한민국의'→'대한민국').~~ ✅ 완료(`feat/korean-josa-tokenizer`, ADR-0004): 받침(종성) 이형태 규칙 기반 `stripParticle`(의존성 0). 받침+최소길이+보호사전으로 오탐('음악가'→'음악') 차단. 형태소 라이브러리(kiwi-nlp)는 보류. 코퍼스 테스트(`korean.test.ts`) 고정.
4. **노드 카테고리 분류**: 제품/뉴스/인물/채널/평판 색 구분(DESIGN-SYSTEM 팔레트). (브랜치 `feat/source-category-classifier`에서 진행 중)
5. **프론트 실데이터 시각 검증**(web+api 띄워 확인) + 모바일 폴백 점검.
6. ROADMAP의 M1 잔여 항목.
7. ~~**국내 커뮤니티 소스**: 디시 등 직접 크롤링은 ToS·robots 위반 → 불가.~~ ✅ 완료(`feat/korean-community-sources`, ADR-0006): 네이버 blog/cafe/kin 확장 + 카카오(다음) web/blog/cafe 어댑터 + 항목별 출처유형 배지 + PIPA 민감정보 마스킹. **카카오 키 입력 시 활성**(`KAKAO_REST_API_KEY`).
8. **YouTube 소스**(선택): Data API v3, 무료(키 필요). 영상 커버리지. SNS 중 유일하게 무료·합법 — 다음 무료 소스 1순위 후보(ADR-0006).

## 6. 알려진 한계
- 한국어 토큰화: 조사 분리는 규칙 기반(ADR-0004)으로 개선됨. 잔여 한계 — 보호 단어 사전은 비완전(신규 `~家`/`~이`/`주의`어 오탐 가능), 복합명사 분해·품사 필터 없음(필요 시 kiwi-nlp 재검토).
- 광범위 웹검색은 **보류 중**(ADR-0005): 구글 신규차단 + Brave 2026-02 무료폐지로 무료 옵션이 희소. 현재 커버리지 = 네이버(한국어) + 위키백과(백과). 글로벌/영문·교차검증은 약함 → 재도입 시 Tavily(무료 1k) 우선.
- 그래프 토픽 = 키워드 빈도 기반(엔티티 해석 고도화는 후속).
- **SNS 커버리지 공백**(ADR-0006): X=유료, 인스타=법인 심사, 페북=공개 검색 API 부재로 보류. 실시간 SNS 여론은 당분간 미수집.
- **PIPA/UGC**: 커뮤니티(cafe/kin/카카오) 유입으로 개인정보 노출 위험 증가. 경계에서 주민번호·휴대전화를 마스킹(`collect/pii.ts`)하나 best-effort — "공개정보·공인 한정" 정책이 1차 방어. 민감정보 필터 고도화는 후속 과제.

## 7. 운영 규칙 (필수)
- 작업 단위 브랜치(`<type>/<설명>`) → 원자적 커밋 → PR → **CI 그린이면 squash 머지+브랜치 삭제**.
- 금지: `git reset`/`git push --force`/`eval`/조건없는 DROP 등([.claude/rules/security.md]). 시크릿·민감 개인정보 노출 금지(PIPA).
- 상세: [CLAUDE.md](../CLAUDE.md) · [FOUNDATION-SPEC](./foundation/FOUNDATION-SPEC.md) · [ADR](./adr/).

## 8. 머지된 PR (이력)
#1 기반·체계 · #2~5 Dependabot · #6 웹 코드분할 · #7 수집 골격 · #8 위키 어댑터 · #9 그래프 품질 · #10 네이버·구글 어댑터 · #11 구글 엄선도메인 ADR.
