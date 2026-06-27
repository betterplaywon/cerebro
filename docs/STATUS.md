# cerebro — 현재 상태 & 재개 가이드 (Handoff)

> **새 세션은 이 문서부터 읽으세요.** 어디까지 했고 다음에 뭘 할지의 단일 기준점.
> 최종 갱신: 2026-06-27 · 구글 JSON API 신규고객 영구차단 + 무료 웹검색 API 유료화 → **광범위 웹검색 보류, 네이버+위키 2소스로 출시**(ADR-0005).
> · 소셜/커뮤니티 검증 → **국내 커뮤니티(네이버 blog/cafe/kin + 카카오 web/blog/cafe) 공식 API로 도입, SNS(X·인스타·페북) 보류**(ADR-0007).
> · **활용 관점 리포트**: 수집 정보를 Claude(Sonnet 4.6)로 정제해 "핵심 요약 + 관점별 활용법(투자/취업/경제…)"을 자식 노드로 제공(ADR-0008). 키 미설정 시 휴리스틱 그래프로 폴백(지출 0).
> · **BE+FE 리팩토링 패스 완료(PR #33–#37)**: 리팩토링 기회 망라 감사 워크플로(영역별 병렬 분석 → 적대적 검증) → 검색상태 판별유니온 합성·그래프빌더 전략 디스패처·캐시/HTTP 견고성·매직넘버 상수화·에러 zod 일관화 등 **확정 8건** 처리. **➡️ 다음 단계 = 최적화**(번들 분할·메모이제이션·렌더 비용; 감사 거부 목록에 후보 집적).
> · **배포 구성 준비(ADR-0009)**: web→Vercel · api→Render 분리 + 런북([`DEPLOYMENT.md`](./DEPLOYMENT.md)) + 레포 루트 `render.yaml`(API 전용, 시크릿 전부 `sync:false`) + `tsx` 런타임 의존성 이동. **배포는 미실행 — 설정만 준비**(실제 배포는 대시보드에서 키 입력 + 연결 순서 따라).
> · **BM 방향 확정(ADR-0010·0011)**: 제품은 **모든 주제(broad) 유지**, 수익은 **"활용 관점(의도)축"으로 점진적 좁힘**. 첫 과금 = **프로슈머 freemium**(검색·탐색·공유=무료 / 저장·내보내기·모니터링·워터마크제거·LLM 무제한·심층=Pro). 하이브리드 계정(검색 익명·저장 로그인). 해자=지능레이어+저장워크플로. 무료 LLM=일 5건+**2단캐시(데이터30분/리포트7일)**+시드프리웜+서킷+스파이크보험. 가격 베타 ₩6,900→정상 ₩9,900. 경계표=[GTM §7.2](./GTM.md)·계측=[GTM §6.1](./GTM.md)·라이선스 게이트=[DATA-SOURCING §11](./DATA-SOURCING.md). **진행**: 캐시2단+프리웜 머지(#45) · PRD/GTM 의도축 정렬(#46) · **모니터링/알림 설계 확정([ADR-0012](./adr/0012-monitoring-alerts.md)·[FEATURE-MONITORING](./FEATURE-MONITORING.md))** · **LLM 예산 서킷 브레이커 머지(#48, [ADR-0013](./adr/0013-llm-budget-circuit-breaker.md))** · **네이버 약관 확인 완료 → 검색결과 상업·재가공·저장 불가 확정 → 소스 라이선스 분리([ADR-0014](./adr/0014-source-license-segmentation.md))**: 네이버·카카오=무료 표시·단순캐시 전용(Layer A) / 수익화·재가공·저장·모니터링=위키 등 상업 OK 소스(Layer B)만. **다음: ① 상업 OK 보강 소스 도입(Tavily 유료·공공데이터 — 수익화 레이어 한국어 커버리지) ② 수집 파이프라인 소스 레이어 분리(표시 A vs 분석/저장 B) ③ Phase 0 계측 구현 ④ 모니터링/알림 구현(하이브리드 계정 M2 선행, 구현 전 보안 검증 게이트).**

## 🔜 다음 작업 — 콜드스타트 단일 기준점 (ADR-0014 이후 · 2026-06-27)

> **새 세션은 이 절부터.** 근거: 코드 그라운드트루스 감사 + 의존순서 설계 + 적대적 검증(7-에이전트 워크플로). 키스톤 실행명세 = [BACKLOG NOW#1](./BACKLOG.md).

### ✅ LAYER-SPLIT 완료 — ADR-0014 능동 위반 해소(2026-06-27, 브랜치 `security/source-layer-split`)
이전 위반(`report.ts`가 네이버·카카오 Layer A 스니펫을 Claude에 보내고 7일 캐시에 적재)을 **단일 게이트로 차단**했다. 구현 요지(상세=[ADR-0014 §구현](./adr/0014-source-license-segmentation.md)):
- `SourceAdapter.layer:'A'|'B'`(단일 진실원) → `normalize()` 전파 → `NormalizedItem.layer`.
- `report.ts`가 LLM 입력 직전 `items.filter(i=>i.layer==='B')`, 0건이면 `null`(휴리스틱 폴백). **LLM 입력·인용·7일 캐시가 모두 Layer B로 정합.**
- `dedup`은 동일 URL A/B 충돌 시 B 보존. 공유 계약 미변경(내부 타입만).
- **정책 결정**: `build.ts`의 Layer A 파생 concept/category 노드는 **휘발성 표시로 허용**(≤30분, 원문은 무수정 노출 — 약관 §2.1 준수). 근거=ADR-0014 §정책 결정.
- **잔여 위험(수락)**: LLM 산출물 PII는 프롬프트 가드 의존 → 출력측 재마스킹은 PII-FILTER와 함께. 무료 Layer B 빈약(위키 위주) → 공공데이터/Tavily로 보강.
- 게이트: typecheck·lint·test(255)·build 그린. report/build/orchestrator/dedup 테스트 전부 통과 + 레이어 게이트 단위테스트 추가.

### 권장 착수 순서 (의존 그래프)
1. ✅ **LAYER-SPLIT** (키스톤) — 완료. 후속의 선행 정합 기반 확보.
2. **PII-FILTER**(BACKLOG NOW#2) · **DELETION-RIGHTS**(BACKLOG NOW#3) — LAYER-SPLIT와 독립·병행 가능. DELETION-RIGHTS는 실프로덕션 배포 전 하드게이트(M1 Exit④). PII-FILTER는 LLM 출력측 재마스킹 잔여위험도 함께 검토.
3. **DOCS-REALIGN** (S) — PRD §4.1/§5.4·GTM §7.2·DATA-SOURCING §2/§3.1·STATUS §1/§4를 Layer A/B로 정렬, ADR-0011/0012·FEATURE-MONITORING §7의 '네이버 약관 미확인'·'서킷 미구현' stale 문구 정리(#48·ADR-0014로 종결됨).
4. **HTTP-POST**(S, `apps/api/src/lib/http.ts` safeFetch POST+body 지원) → **PUBLICDATA-ADAPTER**(M, Layer B 우선) · **TAVILY-ADAPTER**(M, Layer B 후순위·유료, HTTP-POST 의존).
5. **SHARED-LAYER-CONTRACT**(S, M2 저장보드 필요 시) · **PHASE0-INSTR**(M, 의도축 계측 GTM §6.1) · **SUPABASE-AUTH**(L, M2) → **MONITORING**(L, M2 마지막, Layer B 전용 소비).

### ✅ 키스톤(LAYER-SPLIT) 적대적 검증 항목 — 모두 반영 완료 (이력)
- **단일 진실원** = `SourceAdapter.layer:'A'|'B'`(sources/types.ts:30-36). naver/kakao='A', wikipedia='B'. → `normalize()` 시그니처에 layer 인자 → `NormalizedItem.layer` 보존(orchestrator.ts:41에서 adapter.layer 전달) → report.ts:139 직전 `items.filter(i=>i.layer==='B')`, 0건이면 `return null`(휴리스틱 폴백). 이 한 게이트로 LLM 입력·7일 캐시·인용(usage sourceIds)이 정합.
- **(필수)** layer 필수화는 기존 테스트를 깨뜨린다 — `report.test.ts`의 sampleItems()가 전부 `naver`(Layer A)라 필터 도입 시 analyzeUsage가 null → 테스트 실패. **픽스처를 wikipedia(Layer B)로 전환** + `build.test.ts:61`·orchestrator 호출부 갱신. 수용기준에 "필터 도입 후 report/build/orchestrator 테스트 전부 그린" 명시.
- **(정책 결정)** `build.ts:159-213`이 Layer A 제목·스니펫을 토큰화해 concept/category 파생노드를 만든다(ADR-0014 §2.1 '무수정 독립노출'과 긴장). 30분·표시라 저위험이나 키스톤 머지 전 "Layer A는 원문 출처노드만 vs 파생 허용"을 명문화('모두 자동 정합'은 30분 스냅샷 재가공을 누락한 과장).
- **(잔여위험)** LLM 산출물(summary/angles[].report)의 PII는 입력측 redactSensitive 범위 밖 → report.ts 프롬프트 가드에만 의존. 출력측 재마스킹을 추가하거나 ADR에 잔여위험으로 명시 수락.

### DELETION-RIGHTS 착수 시 (적대적 검증 발견)
blocklist 필터를 수집 경로(orchestrator)뿐 아니라 **캐시 read 경로(search-orchestrator.ts:136 스냅샷 hit, :96 reportCache hit)에도** 적용 — 안 하면 차단 주체가 최대 7일 캐시에서 계속 노출. TTL 자연만료 의존만으로는 잊힐권리 하드게이트 미충족 → **즉시 플러시(블록키 캐시 delete) 경로 필수.**

### Layer B 신규 소스 도입 참고 (한국어/시의성 깊이 보전)
LAYER-SPLIT 직후 무료 Layer B가 사실상 위키뿐 → 리포트 입력 ~8건으로 얇아짐(ADR-0014 인지 트레이드오프). 보강:
- **공공데이터포털(우선)**: 금융위 기업기본정보(데이터셋 15043184), '이용허락범위 제한 없음'(상업 OK)·무료·구조화 기업 사실데이터. 호출 호스트 `apis.data.go.kr`(포털 `data.go.kr`과 다름 → SSRF allowHosts 별도 추가). 키=`DATA_GO_KR_SERVICE_KEY`(쿼리 serviceKey, **이중 인코딩 함정**=Decoding키 사용). items 단건이 객체로 옴 → zod preprocess 배열 정규화. GET이라 HTTP-POST 불요. API별 상업가부 제각각 → 데이터셋별 약관확인+ADR.
- **Tavily(후순위·유료 종량 $0.008/credit, 무료 1,000/월·무카드)**: POST `api.tavily.com/search`(→ HTTP-POST 선행). 키=`TAVILY_API_KEY`(Bearer). search_depth=basic·max_results 소량·rate limiter로 비용 상한. **응답 results[].url은 서버 재요청 금지**(저장·표시만; 본문 필요시 /extract 위임). 7일 캐시·저장보드 보관 가부는 약관 정독 게이트(zero data retention ≠ 우리측 캐시 허용).
- 두 소스 모두 키 게이트(naver 패턴) → 키 없으면 registry 자동 제외(무료 운영 기본 비활성). 신규 SourceType('publicdata'/'websearch')은 packages/shared 계약 변경 → FE 합의 후.

### 블로커 / 시크릿 / 열린 질문
- 신규 키(`DATA_GO_KR_SERVICE_KEY`·`TAVILY_API_KEY`·`SUPABASE_*`)는 `.env`(gitignore)+호스팅 시크릿(sync:false)만. `.env.example`=빈 플레이스홀더. 코드/문서/로그/커밋 평문 노출 금지. HTTP-POST의 Authorization 헤더가 로그/에러객체에 새지 않도록.
- 새 SourceType은 FE 합의 후 양측 구현(계약 우선).
- 열린 질문: ① build.ts Layer A 재가공 정책 ② SHARED-LAYER-CONTRACT 도입 시점(M2 보류 vs 지금) ③ Tavily ToS 캐시 보관 가부 ④ Phase 0 계측 저장소(인메모리 vs Supabase 선행) ⑤ 무료 Layer B 빈약기 감수 vs PUBLICDATA를 키스톤과 동일 마일스톤으로 묶기.

---

## TL;DR
기반(문서·8에이전트·모노레포·CI)과 **M1 하이브리드 검색**까지 완료·머지됨. `/api/search`가 **위키백과+네이버**의 실제 공개정보를 수집·정제해 중심-가지 그래프로 반환하고, 프론트(Vite+R3F)가 3D 마인드맵으로 그린다. **구글 Custom Search JSON API는 신규 고객에 영구 차단됨**(공식 — 콘솔은 Enabled여도 호출 시 403). 대체로 검토한 **Brave도 2026-02 무료 폐지(카드 필수)**, Tavily만 무료 1,000건 남음. 보조 웹검색에 카드·과금을 떠안는 건 YAGNI → **지금은 광범위 웹검색을 보류하고 네이버+위키 2소스로 출시**(ADR-0005). 재도입은 트래픽 확인 후(1순위 Tavily).

---

## 1. 지금 동작하는 것
- **검색 → 세레브로 로딩 → 3D 마인드맵 → 노드 상세(요약·활용 리포트·출처)** 핵심 루프 동작.
- **활용 관점 리포트(ADR-0008)**: 키(`ANTHROPIC_API_KEY`) 설정 시 검색당 1회 Claude(Sonnet 4.6) 호출 →
  중심 노드=핵심 정보 요약, 자식 `usage` 노드=관점별(투자/취업/경제/사회/건강/관계/쇼핑/도서/콘텐츠 중
  해당되는 것만) 상세 리포트. 상세 패널이 `report`를 문단으로 렌더. **키 없으면 휴리스틱(카테고리/토픽)
  그래프로 폴백(지출 0)**. 캐시(30분)로 동일 쿼리 재요청 추가 지출 0.
- **출처 투명성**: 그래프 하단 "분석된 출처 N건" + 유형별 한글 배지(네이버·위키백과…), 상세 패널 출처 유형 한글 표기.
- 하이브리드 수집(병렬, 일부 실패 허용) + 캐시(30분) + 빈약 시 mock 폴백.
- 라이브 검증됨: `"토스"` → 출처 19건(**위키 8 + 네이버 11**), 재요청 `cached=true`.

### 소스 어댑터 상태
| 어댑터 | 상태 | 비고 |
|---|---|---|
| `wikipedia` | ✅ 동작 | 키 불필요 (ko.wikipedia REST) |
| `naver` | ✅ 동작 | `.env`에 키 입력됨(로컬). webkr+news+**blog+cafe+kin**(헤더 인증). 일일 25k콜 전 엔드포인트 공유 |
| `kakao` | ⏸️ 키대기 | 다음 web/blog/cafe — 국내 커뮤니티 색인 보완(ADR-0007). `KAKAO_REST_API_KEY` 입력 시 자동 활성 |
| 광범위 웹검색 | ⏸️ 보류 | 구글=신규고객 영구차단(공식), Brave=2026-02 무료폐지(카드필수). 재도입 1순위 Tavily(무료 1k). ADR-0005(0003 대체) |
| SNS(X·인스타·페북) | ⏸️/❌ 보류 | X=유료(읽기 $0.005/post, ~$30~100/월), 인스타=법인 Business Verification+앱심사, 페북=공개글 키워드 검색 API 부재. ADR-0007 |

## 2. 아키텍처 빠른 지도
```
apps/api (Fastify)
  src/server.ts            POST /api/search (zod 검증·캐시·폴백·계약보증), GET /health
  src/collect/             normalize · dedup · score(토픽) · pii(민감정보 마스킹) · orchestrator(allSettled)
  src/sources/             types(RawItem.sourceType 오버라이드) · registry · wikipedia · naver(webkr/news/blog/cafe/kin) · kakao(web/blog/cafe) · example(테스트 fixture)
  src/analyze/report.ts    LLM 활용 관점 분석(Claude Sonnet 4.6, 키 게이트·폴백·PIPA 가드, ADR-0008)
  src/graph/build.ts       수집→GraphSnapshot(분석 있으면 중심+활용관점 / 없으면 중심+카테고리/토픽)
  src/lib/                 http(SSRF-safe fetch) · rate-limit · cache(TTL+LRU) · text(stripHtml)
  src/env.ts               zod 환경검증(옵셔널 키=빈값→비활성)
packages/shared            zod 계약 SSOT (Graph/Source/Subject/Search 스키마)  ← 계약 변경은 여기 먼저
apps/web (Vite+React+R3F)  App(셸) · SearchBar(URL 진실원·딥링크 입력) · 세레브로 로더(CSS) · MindMapView(3D+노드선택) → MindMapCanvas(lazy) · DetailPanel · SourceSummary
  hooks/                   useCerebroSearch(서버상태=TanStack Query + 검색어=URL → SearchState 판별유니온 합성) · useUrlSearchParam(useSyncExternalStore)
  queries/ · api/client    query-factory(키·옵션 팩토리) · searchCerebro(zod 검증·signal 취소)
```
- **새 소스 추가법**: `sources/`에 `SourceAdapter` 구현 + `registry.ts` 등록 → SSRF·캐시·폴백 자동 상속. 키 필요 시 `isEnabled()`로 게이트.

## 3. 로컬 실행 / 검증
```bash
pnpm install
pnpm dev                 # web :5173 + api :8787
pnpm typecheck && pnpm test && pnpm lint && pnpm build   # 전체 게이트 (현재 그린, 테스트 230+개: api 210 + web 23)
```
- 키는 `apps/api/.env`(**gitignore됨**, 커밋 금지)에 있음: 네이버·카카오·Anthropic(작동). 값은 절대 출력/커밋 금지.
- **활용 리포트 비용 관리**: `ANTHROPIC_API_KEY`가 있으면 검색당 1회 Claude 호출(검색당 ~$0.03~0.05, 캐시 재요청은 0).
  지출 차단이 필요하면 `.env`에서 키를 빼면 자동으로 휴리스틱 폴백(0원). 예산 $8.8 ≈ 175~290 고유 검색(ADR-0008).

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

> 📋 **전체 백로그(코드 근거로 명세된 28건, 티어/수용기준/파일/노력/의존성/비용)는 [`docs/BACKLOG.md`](./BACKLOG.md)** 참조.
> 아래는 요약. **다음 세션은 NOW 1번부터.**

**✅ 완료**(이력은 §8·ADR): 하이브리드 검색(위키+네이버+카카오) · 출처 표시 UX(PR #13) · 한국어 조사 분리 토큰화(ADR-0004) · 노드 카테고리 분류(ADR-0006) · 국내 커뮤니티 소스(ADR-0007) · 토픽 노이즈 제거(PR #21) · **LLM 활용 관점 리포트(ADR-0008)** · **시네마틱 3D 마인드맵 + 글래스 타일 라벨(PR #22, postprocessing v2 고정)** · **BE+FE 리팩토링 패스(PR #33–#37, 감사 워크플로 기반)**.

> 🔧 **현재 진행 트랙 = 코드 품질.** 리팩토링 패스 완료 → **다음은 최적화**(사용자 명시). 최적화 후보(감사에서 "리팩토링 아님/최적화"로 분류돼 보류된 것들): `MindMapCanvas` 번들 ~931kB 코드분할 · `CategoryLegend`/`DetailPanel` 메모이제이션 · `DetailPanel` 출처 필터 O(n·m)→Map · 3D 렌더 비용·모바일 Bloom 저감. 아래 NOW/NEXT는 **M1 출시 게이트(제품 트랙)** — 최적화 트랙과 별개로, 출시 준비 재개 시 1번부터.

**🥇 출시 트랙 첫 작업(Top Pick)**: **PIPA/민감정보 필터 고도화**(`pii.ts`에 외국인등록번호·이메일·카드(Luhn)까지 마스킹 — 실측으로 누출 확인) — $0·무의존·단일 파일.

**NOW**(M1 출시 하드 게이트 + 라이브 예산 안전, 셋 다 $0·즉시 착수):
1. **PIPA/민감정보 필터 고도화** — 외국인등록번호(성별코드 5~8)·이메일·카드번호 마스킹 추가.
2. **삭제(잊힐 권리) 요청 경로** — 차단목록 + 요청 채널·고지 + 런북(M1 Exit④·골든룰).
3. ✅ **LLM 예산 자동 상한(서킷 브레이커) 구현 완료**(ADR-0013) — 인메모리 누적 추정비용이 `ANTHROPIC_BUDGET_USD`(기본 8) 도달 시 LLM 분석 자동 차단→휴리스틱 폴백(지출 0), `res.usage` 기록(refusal/빈응답 포함), 월 리셋, `GET /api/usage` 관측. ADR-0012 '비용 가드 선행 미구현' 전제를 일부 충족(모니터링 선행조건).

**NEXT**(M1 클로즈아웃·핵심경험·무료 소스): 한국어 보호사전 확장 → 앱스토어 어댑터 → 대표시드 코퍼스 QA → 그래프 엔티티 해석 → axe 접근성 → **YouTube 어댑터** → 모바일 3D 폴백 → 3D 키보드 내비/a11y(라벨은 PR #22로 완료) → 통합 메트릭(/api/metrics) → Lighthouse CI.

**DEFERRED**(외부 트리거 대기): Tavily 웹검색(트래픽) · Supabase Auth(M2) · kiwi-nlp(측정 GO/NO-GO) · X/Reddit/Instagram(유료·계약·법인심사). Facebook은 영구 미도입(공개검색 API 부재).

## 6. 알려진 한계
- 한국어 토큰화: 조사 분리는 규칙 기반(ADR-0004)으로 개선됨. 잔여 한계 — 보호 단어 사전은 비완전(신규 `~家`/`~이`/`주의`어 오탐 가능), 복합명사 분해·품사 필터 없음(필요 시 kiwi-nlp 재검토).
- 광범위 웹검색은 **보류 중**(ADR-0005): 구글 신규차단 + Brave 2026-02 무료폐지로 무료 옵션이 희소. 현재 커버리지 = 네이버(한국어) + 위키백과(백과). 글로벌/영문·교차검증은 약함 → 재도입 시 Tavily(무료 1k) 우선.
- 그래프 토픽 = 키워드 빈도 기반(엔티티 해석 고도화는 후속).
- **SNS 커버리지 공백**(ADR-0007): X=유료, 인스타=법인 심사, 페북=공개 검색 API 부재로 보류. 실시간 SNS 여론은 당분간 미수집.
- **PIPA/UGC**: 커뮤니티(cafe/kin/카카오) 유입으로 개인정보 노출 위험 증가. 경계에서 주민번호·휴대전화를 마스킹(`collect/pii.ts`)하나 best-effort — "공개정보·공인 한정" 정책이 1차 방어. 민감정보 필터 고도화는 후속 과제.

## 7. 운영 규칙 (필수)
- 작업 단위 브랜치(`<type>/<설명>`) → 원자적 커밋 → PR → **CI 그린이면 squash 머지+브랜치 삭제**.
- 금지: `git reset`/`git push --force`/`eval`/조건없는 DROP 등([.claude/rules/security.md]). 시크릿·민감 개인정보 노출 금지(PIPA).
- 상세: [CLAUDE.md](../CLAUDE.md) · [FOUNDATION-SPEC](./foundation/FOUNDATION-SPEC.md) · [ADR](./adr/).

## 8. 머지된 PR (이력)
- **기반·수집(#1–#11)**: #1 기반·체계 · #2~5 Dependabot · #6 웹 코드분할 · #7 수집 골격 · #8 위키 어댑터 · #9 그래프 품질 · #10 네이버·구글 어댑터 · #11 구글 엄선도메인 ADR.
- **소스·UX·LLM(#12–#23)**: #12 STATUS 핸드오프 · #13 출처 요약·배지 · #14 한국어 조사 토큰화(ADR-0004) · #15 Brave 어댑터→#16 보류·제거 · #17/#18 카테고리 분류·팔레트(ADR-0006) · #19 국내 커뮤니티 소스(ADR-0007) · #20 ADR 재번호 · #21 토픽 노이즈 제거 · #22 시네마틱 3D 마인드맵 · #23 LLM 활용 관점 리포트(ADR-0008).
- **리팩토링 패스(#24–#37)**: #24 수집 보일러플레이트 공용화(fetchJson) · #25 BACKLOG.md · #26 Search Orchestrator 분리 · #27 TanStack Query 이관(+MSW) · #28 외부응답 zod 검증 · #29 query-factory 패턴 · #30 검색어 진실원 URL화 · #31 일관 에러 스키마 · #32 매직넘버 상수화·중첩삼항 제거 · **#33 판별유니온+MindMapView · #34 그래프빌더 디스패처 · #35 캐시/HTTP 견고성 · #36 명료화·naver 가드 · #37 에러 zod 일관화·딥링크 입력**.
- **문서(#38)**: #38 README 다국어화.
