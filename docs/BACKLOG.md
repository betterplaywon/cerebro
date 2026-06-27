# cerebro — 작업 백로그 (Backlog)

> 다음 세션이 바로 집어들 수 있도록 정리한 후보 작업. **코드 근거로 명세**(2026-06-26, 멀티에이전트 분석 28건).
> **재개 순서**: [`docs/STATUS.md`](./STATUS.md) → 이 문서 **NOW 1번**부터. 완료 이력은 STATUS §8 / `docs/adr/` / 메모리.
> 우선순위 기준(가중치 순): ①사용자 가치 ②착수 가능성 ③노력 대비 효과 ④의존성 순서 ⑤비용/리스크. 무료·무카드·PIPA 골든룰 준수.

## 🥇 다음 세션 첫 작업 (Top Pick)

**[pipa-sensitive-filter-hardening] PIPA/민감정보 필터 고도화 — 외국인등록번호·이메일·카드(Luhn) 마스킹 (M1 출시 하드게이트)**

ADR-0014 소스 레이어 분리(키스톤)는 **✅ 완료**(브랜치 `security/source-layer-split` — `report.ts`가 LLM 입력·7일 캐시·인용을 `items.filter(layer==='B')`로 게이트, 단일 진실원=`SourceAdapter.layer`). 다음 최우선은 M1 출시 하드게이트다. `pii.ts`의 redactSensitive가 주민번호·휴대전화 2종만 마스킹해 외국인등록번호·이메일이 실측상 그대로 통과한다(상세=NOW#1). LLM 호출 0·외부키 0·계약변경 0이라 비용 대비 안전성 이득이 크다. **병행 가능한 독립 게이트** = data-deletion-request-flow(NOW#2, 실배포 전 하드게이트). LAYER-SPLIT의 잔여위험(LLM 산출물 PII 출력측 재마스킹)도 이 작업과 함께 검토 권고.

## ⚠️ 통합·순서 주의 (Synthesis Notes)

관측성 4종이 강하게 중복된다: llm-budget-auto-cap(now)이 자체 사용량 기록을 포함해 llm-usage-cost-metrics를 대체하고, cost-quota-monitoring-dashboard-m2(next)가 캐시+쿼터+비용 /api/metrics 슈퍼셋이며 usage-report-cache-quality-monitoring은 그 모듈에 합쳐야 한다 — 메트릭 모듈은 하나만 만들고 확장할 것. 순서 의존: 3d-node-labels-keyboard-nav(next)가 제공하는 접근성 DOM 노드 레이어가 playwright-e2e-suite(later) 헤드라인 spec의 선결조건이므로 a11y 라벨/키보드를 먼저, E2E를 뒤에 둔다. SOURCE_TYPES에 appstore/sns/web은 이미 존재(계약변경 0)하나 video는 없으므로 YouTube는 'sns' 재사용 시 S, 신규 'video' 배지 채택 시 shared→web 교차 변경으로 M이 된다.

## 티어 요약

| 티어 | 항목 (우선순위 순) |
|---|---|
| **NOW** | 1. pipa-sensitive-filter-hardening · 2. data-deletion-request-flow  ·  (✅ 완료: adr0014-source-layer-split → security/source-layer-split, llm-budget-auto-cap → #48/ADR-0013) |
| **NEXT** | 1. korean-tokenizer-protected-dict-expansion · 2. additional-sources-appstore-publicdata-m2 · 3. representative-seed-corpus-qa · 4. graph-entity-resolution · 5. axe-accessibility-tests · 6. youtube-data-api-adapter · 7. mobile-3d-quality-fallback · 8. 3d-node-labels-keyboard-nav · 9. cost-quota-monitoring-dashboard-m2 · 10. lighthouse-ci-perf-budget |
| **LATER** | 1. graph-ux-filters-history-share-m2 · 2. usage-report-cache-quality-monitoring · 3. llm-usage-cost-metrics · 4. analytics-observability-m2 · 5. graph-performance-lod-budget · 6. frontend-live-data-visual-qa · 7. i18n-scaffolding-ko-only · 8. playwright-e2e-suite · 9. paid-feature-flags-m2 |
| **DEFERRED** | 1. tavily-web-search-adapter · 2. supabase-auth-m2 · 3. korean-morphological-analyzer-eval · 4. x-twitter-source-adapter-gated · 5. reddit-source-adapter-gated · 6. instagram-source-adapter-gated |

---

## NOW · 다음 세션 즉시

_**ADR-0014 컴플라이언스 게이트(소스 레이어 분리)는 ✅ 완료**(브랜치 security/source-layer-split — report.ts가 LLM 입력·7일캐시·인용을 Layer B로 게이트, 단일 진실원=SourceAdapter.layer). 다음 최우선은 M1 출시 하드게이트(PIPA 민감정보 필터·삭제요청 경로)를 닫는 것. 모두 readiness=ready·$0·외부 의존 0, 코드 검증으로 실제 공백 확인(pii.ts 외국인등록번호·이메일 미마스킹, registry 차단목록 부재). 예산 서킷 브레이커는 #48/ADR-0013으로 완료._

### ✅ (완료 — 2026-06-27, 브랜치 `security/source-layer-split`) ADR-0014 소스 레이어 분리 — Layer A(표시)/Layer B(분석·저장) 게이트
`id: adr0014-source-layer-split` · ✅ **완료** — `report.ts`가 LLM 입력·7일 캐시·인용을 `items.filter(layer==='B')`로 게이트(단일 진실원=`SourceAdapter.layer`). dedup A→B 보존, 공유계약 미변경, `CACHE_TTL_MS` 상한으로 Layer A 표시 ≤30분 강제, 레이어 게이트 단위·통합테스트 추가. 아래는 명세 이력.

**왜**(완료 전 근거): 코드가 ADR-0014를 능동적으로 위반했다. `report.ts`가 네이버·카카오(Layer A) 스니펫을 출처유형 구분 없이 신뢰도순 상위 18건(`MAX_SOURCES`=18, report.ts:40)으로 Claude에 전송하고, 그 파생 리포트가 7일 reportCache에 적재된다 = PIPA 골든룰급 부채. 근본 원인은 정규화 후 provenance 소실 — `SourceType` enum이 제공자(naver)와 콘텐츠유형(blog/web)을 혼재해 `Source.type`만으로는 Layer A를 식별·필터할 수 없다(네이버-blog와 카카오-blog가 동일 'blog', 카카오-web과 향후 Tavily-web이 동일 'web'). 명시적 `layer` 태그를 도입하면 LLM 입력·7일 캐시·인용 누출을 단일 게이트로 차단하고, 후속 Layer B 어댑터·모니터링의 정합성 기반이 된다.

**수용 기준**:
- `SourceAdapter`에 `readonly layer: 'A'|'B'` 추가(단일 진실원). naver/kakao='A', wikipedia='B'.
- `normalize()` 시그니처에 layer 인자 추가, `NormalizedItem.layer` 보존(Source 공유계약은 미변경 — 내부 타입에만). orchestrator.ts:41에서 루프 스코프 adapter.layer 전달.
- report.ts:139 `top` 산출 직전 `const layerB = items.filter(i=>i.layer==='B'); if(layerB.length===0) return null;` 후 layerB 정렬·slice. → 단위테스트: 네이버/카카오를 섞어도 LLM user 메시지(sourceLines)에 Layer A 0건, Layer B 0건이면 null 폴백(지출 0).
- 7일 reportCache·usage 노드 sourceIds(report.ts:179)에 Layer A 미포함. 30분 스냅샷은 Layer A 표시노드/출처 유지(ADR: A는 ≤30분 단순캐시 허용).
- **(적대적 검증·필수)** 필터 도입은 기존 테스트를 깨뜨린다 — `report.test.ts`의 sampleItems()가 전부 `naver`(Layer A)라 analyzeUsage가 null 반환. **픽스처를 wikipedia(Layer B)로 전환** + `build.test.ts:61`·orchestrator 호출부 갱신. 수용기준: report/build/orchestrator 테스트 전부 그린.
- dedupeByUrl(dedup.ts) 동일 URL 충돌 시 Layer B 우선 보존(분석가능 항목이 A 중복에 밀리지 않게).
- pnpm lint·typecheck·test 그린, 새 any/console.log 없음.

**건드릴 파일(예상)**: `apps/api/src/sources/types.ts:30-36`, `apps/api/src/sources/naver.ts`, `apps/api/src/sources/kakao.ts`, `apps/api/src/sources/wikipedia.ts`, `apps/api/src/collect/normalize.ts:6-10,65-87`, `apps/api/src/collect/orchestrator.ts:41`, `apps/api/src/analyze/report.ts:139`, `apps/api/src/collect/dedup.ts`, `apps/api/src/analyze/report.test.ts (픽스처 전환)`, `apps/api/src/graph/build.test.ts`, `docs/adr/0014-source-license-segmentation.md (구현 반영)`, `docs/STATUS.md`
**노력 근거**: BE 단일 앱 내, layer 한 필드를 어댑터→normalize→NormalizedItem까지 전파 + report.ts 한 줄 게이트 + 테스트 픽스처 전환이 핵심이라 M. 공유계약(packages/shared) 미변경(내부 타입만)이라 L 아님. SHARED-LAYER-CONTRACT(FE 노출)는 M2 저장보드 필요 시 별도.
**의존성**: 없음(후속 PUBLICDATA/TAVILY/모니터링의 강한 선행).
**리스크**: build.ts:159-213이 Layer A 제목·스니펫을 토큰화해 concept/category 파생노드 생성(ADR §2.1 '무수정 독립노출'과 긴장) — 30분·표시라 저위험이나 키스톤 머지 전 'Layer A 원문 출처노드만 vs 파생 허용' 정책 명문화 필요('모두 자동 정합'은 30분 스냅샷 재가공을 누락한 과장). LLM 산출물(summary/angles[].report) PII는 입력측 마스킹 범위 밖 → 프롬프트 가드 의존(출력측 재마스킹은 PII-FILTER와 함께 검토). 무료 Layer B가 사실상 위키뿐이라 리포트 입력 ~8건으로 얇아짐 → PUBLICDATA/TAVILY로 보전.
**비용**: $0(코드 변경만). LLM 입력을 Layer B로 줄여 토큰·예산에 미세 우호적.
**후속(Layer B 한국어 보강)**: 공공데이터포털 금융위 기업기본정보(데이터셋 15043184, 상업 OK·무료, 호스트 apis.data.go.kr, 키 DATA_GO_KR_SERVICE_KEY, 이중 인코딩 주의) → NEXT#2(additional-sources)로 승격 권고. Tavily(POST·유료 종량, HTTP-POST 선행, 키 TAVILY_API_KEY) → DEFERRED#1 트리거를 '실트래픽'에서 'Layer B 한국어 커버리지 보강'으로 재정의.

### 2. PIPA/민감정보 필터 고도화 (구조적 식별자 패턴 확장 + 오탐 저감)
`id: pipa-sensitive-filter-hardening` · 노력 **M(중간)** · 🟢 착수 가능 · tier:now

**왜**: UGC(네이버 cafe/kin·카카오) 유입으로 개인정보 노출 위험이 웹/뉴스보다 높다(ADR-0007 트레이드오프, STATUS §6). 현재 경계 가드 redactSensitive는 주민번호([1-4]만)·휴대전화 2종만 마스킹한다. node로 실측한 결과 (1)외국인등록번호(성별코드 5-8, '900101-5234567')와 (2)이메일('hong@test.com')이 그대로 통과함을 확인했다. PIPA는 골든룰이고 이 작업은 LLM 호출 0·외부키 0·계약변경 0이라 비용 대비 안전성 이득이 크다. 마스킹은 토큰화·저장·표시뿐 아니라 report.ts가 snippet을 Claude로 보내기 전 단계이므로 Anthropic에 PII가 전송되는 것도 함께 줄인다.

**수용 기준**:
- pii.test.ts: 외국인등록번호(성별코드 5~8, 예 '900101-5234567')가 마스킹된다 — 현재는 통과함(실측 확인)
- pii.test.ts: 이메일('hong@test.com')이 마스킹된다 — 현재는 통과함(실측 확인)
- pii.test.ts(신용카드, Luhn 적용): 유효 카드번호('4111 1111 1111 1111')는 마스킹되고, Luhn 불통과 16자리(임의 코드·제품번호)는 마스킹되지 않는다(오탐 저감)
- 오탐 회귀 테스트(코퍼스): 공개 대표 유선번호('02-1234-5678'), Luhn 불통과 16자리 코드, 긴 숫자 기사ID('2024010112345678'), 정상 본문은 원문 그대로 유지된다
- redactSensitive는 title·snippet에만 적용되고 url은 변형하지 않는다(현 normalize.ts 동작 보존 — URL ID 오탐 원천 차단)
- 주소·금융상세·건강 등 자유서술형 민감정보는 정규식 범위 밖임을 코드 주석/ADR에 명시하고 LLM 프롬프트 가드(report.ts SYSTEM_PROMPT)+공인한정 정책(category-rules personGuard)에 위임함을 문서화
- pnpm --filter api test && pnpm typecheck && pnpm lint 그린(새 any/console.log 없음)

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/collect/pii.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/pii.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/category-rules.ts`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`, `/Users/kang/Desktop/cerebro/docs/adr/0007-social-community-sources.md`
**노력 근거**: 단일 파일(pii.ts) 정규식 확장 + 테스트가 핵심이라 S에 가깝지만, 오탐 저감이 본 작업의 절반(특히 신용카드 Luhn 검증·대표번호/제품코드/기사ID 회귀 코퍼스 구성)이라 검증 부담으로 M. 계약(packages/shared) 변경 없음, 외부 의존성 추가 없음(Luhn은 ~10줄 순수함수, 라이브러리 불필요 — YAGNI 준수). 주소/건강 자유서술형까지 정규식으로 욕심내면 L로 폭주하므로 명시적 비범위로 제외.
**의존성**: 없음(외부키·승인·트래픽 선결조건 없음). 참고: ADR-0007 이미 Accepted, 마스킹 가드 신설 결정 근거 존재. 카카오 키(KAKAO_REST_API_KEY) 입력으로 실 UGC 트래픽이 늘면 가치가 커지나 착수 차단요인은 아님.
**리스크**: 과탐(오탐)으로 정상 콘텐츠 훼손: 16자리 카드 패턴이 제품 일련번호·게시글 코드와 충돌 → Luhn 체크 필수, 한국 휴대전화 외 유선/대표번호는 정책상 비마스킹 유지; 정규식만으로는 주소·금융상세·건강·정치/종교 등 자유서술형 민감정보를 못 잡음 → 'best-effort 경계 가드' 한계를 과대표현 금지(coverage 오해 방지). 1차 방어는 공인·공개정보 한정 정책 + LLM 프롬프트 가드; 외국인등록번호 정규식 확장([1-4]→[1-8]) 시 일반 13자리 숫자열 충돌 가능성 — \b 경계 + 성별코드 위치 제약으로 완화하고 회귀 테스트로 고정; 마스킹 토큰('●●●')이 normalize.tokenize 경로에서 토픽 노이즈가 되지 않는지(길이·불용어 필터 통과) 확인 필요
**비용**: 비용 0. 순수 정규식·동기 함수만 추가하므로 Anthropic 예산($8.8)·외부 API·카드 무관. 부수효과로 snippet을 Claude(report.ts)로 보내기 전 PII를 더 걸러 외부 전송 리스크·토큰을 미세 절감(키 게이트·캐시·폴백 패턴 그대로 유지).

### 3. 삭제(잊힐 권리) 요청 대응 경로 — 수집 차단목록 + 제품 내 요청 채널/고지 + 운영 런북
`id: data-deletion-request-flow` · 노력 **M(중간)** · 🟢 착수 가능 · tier:now

> ⚠️ **적대적 검증 추가요건**: blocklist 필터를 수집 경로뿐 아니라 **캐시 read 경로(search-orchestrator.ts:136 스냅샷 hit·:96 reportCache hit)에도** 적용 + **즉시 플러시(블록키 캐시 delete) 경로** 필수. TTL 자연만료(30분/7일) 의존만으로는 잊힐권리 하드게이트 미충족(차단 주체가 최대 7일 노출).

**왜**: M1 Exit Criteria ④의 필수 게이트라 출시 전 처리 권장.

**수용 기준**:
- API 차단목록 모듈 신규(apps/api/src/collect/blocklist.ts): 데이터 파일(초기 빈 목록)을 zod로 검증해 로드하고 isBlockedUrl(url)·isBlockedQuery(query) 순수함수 제공. 잘못된 항목은 부팅 시 명확히 실패(env.ts의 zod 경계 패턴 준수).
- orchestrator.collectAll이 차단 host/url의 RawItem을 normalize 이전에 제외 — 단위테스트: 차단 host를 포함한 fixture 어댑터 주입 시 결과 items 0건, 비차단 항목은 통과(apps/api/src/collect/blocklist.test.ts).
- /api/search가 차단된 query에 대해 결과 그래프 대신 '삭제요청으로 비표시' 안내 응답을 200 + SearchResponseSchema 통과 형태로 반환 — app.inject 통합테스트(server.test.ts)로 검증. 동명이인 과차단 방지를 위해 query 차단은 정규화 완전일치로만.
- Web: 전역 footer(또는 정책 링크 영역)에 '개인정보·삭제요청 안내' 링크 노출(App.tsx) + DetailPanel에서 인물 주제(subject.type==='person') 또는 person 노드에 '공개정보 기반 · 삭제요청 안내' 고지+링크 표시 — 컴포넌트 테스트로 person 노드 렌더 시 링크 존재 확인(QA AC-6).
- 요청 채널 주소는 환경변수(예: VITE_PRIVACY_CONTACT)로 주입하고 미설정 시 정책 페이지/플레이스홀더로 폴백 — 실주소·시크릿을 코드/문서에 하드코딩 금지(SECURITY.md 말미 원칙). .env.example에 빈 플레이스홀더 추가.
- 문서: 삭제요청 운영 런북 신규(docs/runbooks/data-deletion.md 또는 docs/PRIVACY.md) — 접수→본인/대리 확인→공개정보·법적근거 검토→blocklist 등록→회신(SLA 영업일 10일)→처리 이력·타임스탬프 보존 + blocklist 파일 갱신 방법. SECURITY.md §3.4 mermaid 흐름과 정합. 파일기반(무DB) 차단목록 결정을 ADR로 기록(대안=Supabase Subject CASCADE는 M2, 트레이드오프=30분 캐시 staleness·best-effort).
- pnpm lint·typecheck·test·build 그린, gitleaks 통과, 새 any/console.log 없음(coding-standards 자가 점검).

**건드릴 파일(예상)**: `apps/api/src/collect/blocklist.ts (신규 — 차단목록 로드·검증·isBlockedUrl/isBlockedQuery)`, `apps/api/src/collect/blocklist.data.ts (신규 — 초기 빈 hosts/urls/queries; 운영자가 갱신)`, `apps/api/src/collect/blocklist.test.ts (신규)`, `apps/api/src/collect/orchestrator.ts (collectAll에 차단 host/url 필터 통합; 현재 isHttpUrl 필터 옆)`, `apps/api/src/server.ts (POST /api/search에 차단 query 단락 처리 + 안내 그래프)`, `apps/api/src/server.test.ts (차단 query 통합테스트 추가)`, `apps/web/src/App.tsx (footer/안내 링크 렌더)`, `apps/web/src/components/Footer.tsx 또는 PrivacyNotice.tsx (신규)`, `apps/web/src/components/DetailPanel.tsx (인물 주제/노드 삭제요청 고지)`, `apps/web/src/index.css (footer/고지 스타일)`, `.env.example (PRIVACY_CONTACT 빈 플레이스홀더)`, `docs/runbooks/data-deletion.md 또는 docs/PRIVACY.md (신규 런북/정책)`, `docs/adr/0009-file-based-deletion-blocklist.md (신규 ADR)`, `docs/SECURITY.md (§3.4를 실제 구현 위치와 정합 갱신)`, `docs/STATUS.md (백로그·현재 상태 갱신)`
**노력 근거**: 세 갈래(BE 차단목록 모듈+orchestrator/server 통합+테스트, FE footer+DetailPanel 고지+테스트, 런북/ADR 문서)로 나뉘지만 각 변경 자체는 작다. blocklist는 ~40줄 모듈+빈 데이터파일, orchestrator/server 통합은 소규모, footer는 작은 컴포넌트, DetailPanel은 조건부 블록 추가. 무DB·무외부의존(파일기반)이라 인프라 작업 없음. 한 세션(~1~1.5d)에 가능하나 M 상단. 필요 시 PR을 'BE 차단 강제'와 'FE 채널/고지+문서' 둘로 분리 가능(권장).
**의존성**: 없음(M1 범위는 외부 차단 없이 착수 가능 — env 플레이스홀더로 채널 노출). 후속: DB 기반 Subject CASCADE 삭제(docs/DATA-MODEL.md §)는 Supabase/Auth 도입(ADR-0002, M2)에 의존하므로 본 작업 범위 밖. 운영 배포 시점에 실제 privacy 연락처/도메인 확정 필요하나 env 주입으로 출시 비차단.
**리스크**: 동명이인 과차단: query 단위 차단은 같은 이름 인물 전체를 가릴 수 있음 → host/url 차단을 우선, query 차단은 정규화 완전일치+운영자 재량으로 보수적 운용.; 30분 인메모리 캐시 staleness: blocklist 갱신 직후 기존 캐시 항목은 ≤30분 잔존 가능 → 즉시성 필요 시 캐시 무효화 훅 추가(스코프 트레이드오프; ADR에 명시).; best-effort 한계: 원본 소스 제거는 cerebro 권한 밖 — '색인/표시 차단'만 보장한다는 문구를 고지/런북에 정확히 표기(과약속 방지).; blocklist 데이터 파일 자체가 차단 대상(인물명)을 담으면 또 다른 개인정보 보관이 됨 → 도메인/URL 위주 최소 보관, 커밋 시 PIPA 검토(불가피한 식별자는 최소화).; 실주소/시크릿 하드코딩 금지(골든룰 1·SECURITY §2.3) — 반드시 env 주입+빈 .env.example.
**비용**: $0. 무DB(파일 기반 차단목록), Anthropic 미사용(LLM 무관 — 예산 $8.8 영향 0), 무카드. 기존 캐시·폴백·키게이트 패턴 유지. 차단 query 단락은 오히려 불필요한 수집/LLM 호출을 줄여 비용에 미세 우호적.

### ✅ (완료 — PR #48 / [ADR-0013](./adr/0013-llm-budget-circuit-breaker.md)) LLM 예산 자동 상한(서킷 브레이커)
`id: llm-budget-auto-cap` · ✅ **완료(2026-06-27)** — `apps/api/src/analyze/budget.ts` + `GET /api/usage` 라이브. 인메모리 누적·pre-flight 차단·월(UTC) 리셋·cap=0 킬스위치. 아래는 구현 이력.

**왜**: 자동 상한은 비용 사고를 코드로 봉인하고, 키 게이트·캐시·폴백이라는 기존 패턴을 그대로 확장한다.

**수용 기준**:
- budget 모듈 단위 테스트: record(input,output 토큰) 누적 비용이 Sonnet 4.6 단가($3/$15 per 1M, ADR-0008·claude-api 스킬로 확인)로 정확히 계산된다(예: input 3000+output 2500 → $0.009+$0.0375=$0.0465, 부동소수 허용오차 내).
- budget 모듈 단위 테스트: 누적 비용이 cap(ANTHROPIC_BUDGET_USD) 이상이면 isOpen()/canSpend()가 true→차단 상태를 반환한다(경계값: cap 직전=허용, cap 도달/초과=차단).
- analyzeUsage 테스트: 서킷이 열린(예산 소진) 상태에서 analyzeUsage 호출 시 client.messages.create가 호출되지 않고 null을 반환한다(지출 0 — 기존 '키 없으면 null' 테스트와 동일 패턴, deps.client 스파이로 검증).
- analyzeUsage 테스트: 정상 호출 후 res.usage.input_tokens/output_tokens(+cache_* 있으면 포함)가 budget에 기록되어 누적 비용이 증가한다(mock client가 usage를 반환하도록 확장).
- analyzeUsage 테스트: 응답이 refusal/빈 텍스트여도, API가 토큰을 청구한 경우(res.usage 존재) 사용량은 기록된다(early-return 전에 record 호출).
- server 통합 테스트(app.inject): 예산 소진 상태에서 /api/search가 200을 유지하고 휴리스틱(카테고리/토픽) 그래프로 폴백하며 계약(GraphSnapshotSchema)을 만족한다(검색이 끊기지 않음).
- 관측 가능성: GET /api/usage(또는 /health 확장)가 시크릿 없이 누적 토큰/추정비용/cap/남은예산/open여부를 반환한다(키 값·평문 시크릿 미노출).
- 리셋 윈도우: 월(달력) 경계 또는 설정 기간을 넘기면 카운터가 0으로 리셋되어 서킷이 닫힌다(시계 주입 테스트로 검증).
- env 검증: ANTHROPIC_BUDGET_USD(기본값 8, $8.8 미만 헤드룸) 등 신규 변수가 zod로 검증되고 미설정 시 안전한 기본값으로 동작한다.
- .env.example에 ANTHROPIC_BUDGET_USD(및 단가/윈도우 변수)가 빈/기본 플레이스홀더와 주석으로 문서화된다.
- pnpm typecheck && pnpm test && pnpm lint && pnpm build 그린(신규 any/console.log 없음).

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/analyze/budget.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/budget.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts`, `/Users/kang/Desktop/cerebro/.env.example`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.test.ts`, `/Users/kang/Desktop/cerebro/docs/adr/0013-llm-budget-circuit-breaker.md`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 핵심 로직은 작다(in-memory 누적기 + pre-flight 게이트 + post-call record). 기존 lib/rate-limit.ts·lib/cache.ts의 팩토리+클로저 패턴, report.ts의 deps.client 주입 테스트 패턴이 그대로 재사용돼 통합 지점이 명확하다. M인 이유: (1) 비용 계산 정확성(res.usage의 input/output + cache_creation/cache_read 분리, 단가 = 모델별 → env 설정형 단가 또는 모델→단가 소형 테이블), (2) 리셋 윈도우(달력 월) 시맨틱과 시계 주입 테스트, (3) refusal·빈응답에도 청구분 기록하는 순서 처리, (4) 관측 엔드포인트 + env/zod + .env.example + 짧은 ADR + STATUS 갱신까지 포함. 단일 앱(apps/api) 내 변경이라 L은 아님.
**의존성**: 없음
**리스크**: in-memory 카운터는 프로세스 재시작 시 0으로 리셋된다(현재 캐시도 in-memory, package.json에 DB/Supabase 의존 없음). 잦은 재시작이 반복되면 윈도우당 실제 지출이 cap을 누적 초과할 수 있음 → MVP 단일 인스턴스에서 허용, 한계로 명시. 영속화(파일/Supabase)는 후속.; 다중 인스턴스 배포 시 인스턴스별 독립 카운터라 전체 합산이 cap을 넘을 수 있음 → MVP 단일 인스턴스 전제, ADR에 트레이드오프 기록.; 동시 검색 레이스: 여러 요청이 record 전에 pre-flight를 통과해 약간 초과 가능(상한 ≈ 동시성 × 검색당 ~$0.05). 직렬화는 YAGNI → cap을 $8.8보다 낮게(기본 8) 잡아 헤드룸 확보로 완화.; 비용 추정 정확도는 모델별 단가에 의존. ANALYSIS_MODEL 교체 시 단가 동기화 필요 → env 설정형 단가(기본 Sonnet 4.6 $3/$15) 또는 모델ID→단가 소형 상수표로 처리, 불일치는 보수적(상향) 추정.; 관측 엔드포인트에서 실수로 키/시크릿이 새지 않도록 주의(2026-06-26 세션의 구글 키 평문 출력 사고 교훈). 토큰 수·추정비용 등 비민감 집계만 노출.
**비용**: 자기 자신은 추가 API 호출이 전혀 없어 비용 증가 0(테스트는 deps.client mock으로 네트워크 0). 오히려 $8.8 예산 초과 위험을 코드로 봉인하는 순(純)비용 절감/안전 장치. 캐시 히트는 애초에 LLM을 호출하지 않으므로 카운트되지 않음(기존 동작 유지). 단가 기본값은 Sonnet 4.6 $3/$15 per 1M(ADR-0008 및 claude-api 스킬로 확인), 모델 변경 시 env로 조정.

---

## NEXT · NOW 직후

_NOW 직후의 M1 클로즈아웃(검증 게이트·a11y·모바일·성능 가드) + 무키 폴백 그래프의 핵심 경험 품질 + 무료·즉시 가능한 소스 커버리지 확장. 전부 readiness=ready·$0이며, 저비용 고효과(S 슬라이스) 순으로 앞에 두었다._

### 1. 한국어 토큰화 보호 단어 사전 확장·증거기반 회귀(의존성 0 유지)
`id: korean-tokenizer-protected-dict-expansion` · 노력 **S(작음)** · 🟢 착수 가능 · tier:next

**왜**: 규칙 기반 조사 분리(ADR-0004)의 개방 클래스 잔여 오탐을 의존성 0으로 줄여 한국어 토픽 품질(핵심 루프)을 점진 개선한다.

**수용 기준**:
- PROTECTED_WORDS(apps/api/src/collect/korean.ts)에 세 잔여 클래스의 증거기반 큐레이션 항목을 추가한다: (a) 도(島)·로(路) 지명/역명 중 받침·길이 가드를 통과해 오절단되는 ≥2음절 고가치어, (b) 받침+'이' 보통명사(예: 곰팡이·잠자리류 중 실검증된 것), (c) ~과(科) 진료과 중 받침 어간 2음절+이라 오절단되는 항목(산부인과·정신과·신경과 등).
- korean.test.ts의 adversarial 회귀 배열에 신규 항목별 케이스를 추가하고 `pnpm --filter api test`가 그린이다(stripParticle(word)===word 검증).
- 기존 true-positive 코퍼스(토스가→토스, 대한민국의→대한민국, 카카오톡으로→카카오톡 등)와 passthrough/false-positive 코퍼스가 모두 그대로 통과한다 — 조사 분리 회귀 없음.
- 학과(~학과)는 일괄 보호하지 않는다: '컴퓨터공학과'→'컴퓨터공학', '경영학과'→'경영학'(분야명 절단=의도된 동작)이 테스트로 고정되고, 진료과만 보호됨을 케이스로 구분한다.
- 구조적으로 이미 안전한 항목은 사전에 넣지 않는다: 모음 어간 진료과(소아과·피부과·비뇨기과)와 1음절 어간(내과·외과·안과)은 사전 미등록 상태로도 보존됨을 회귀 테스트로 명시(불필요한 사전 비대화 방지).
- apps/api/package.json 의존성 수 불변(새 라이브러리 없음). `pnpm --filter api build`·`pnpm lint`·`pnpm typecheck` 그린, 신규 any/console.log 없음.
- ADR-0004 트레이드오프/한계 절과 docs/STATUS.md §6의 '보호 사전 비완전' 문구를 확장 범위에 맞게 갱신(특히 ~과 클래스가 준-폐쇄로 거의 덮였음을 기록).

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/collect/korean.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/korean.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/pipeline.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/score.ts`, `/Users/kang/Desktop/cerebro/docs/adr/0004-korean-josa-rule-tokenizer.md`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 변경이 국소적이다: 핵심은 korean.ts의 PROTECTED_WORDS(ReadonlySet) 한 곳에 큐레이션 항목 추가 + korean.test.ts 회귀 케이스 추가. 새 의존성·아키텍처 변경 없음. ~과(科)는 준-폐쇄집합이라 적대적 코퍼스 작성 부담이 작다(node 시뮬레이션으로 위험 항목이 산부인과·정신과·신경과 등 소수임을 확인). 오프라인·무비용이라 검증 루프가 빠르다. 도(島)/로(路)·받침+이는 개방 클래스라 '실검증 고가치어'로 범위를 한정하면 0.5d 내 완료 가능. (ADR §대안의 집계단계 '증거기반 병합'까지 score.ts에 함께 구현하면 M으로 상향되나, 본 후보의 oneLiner는 사전 확장이 1차 산출물이므로 그 구조적 작업은 별도 트리거로 분리 권장.)
**의존성**: 없음
**리스크**: 보호 사전은 ADR-0004가 명시한 개방 클래스 화이트리스트라 본질적으로 비완전 — 도(島)/로(路)·받침+이는 신규 고가치어가 계속 생겨 whack-a-mole 유지보수가 남는다(거짓 안심 주의). 반면 ~과(科)는 준-폐쇄라 거의 완결 가능.; 품사 문맥이 없어 동음 어간 모호성 존재: '정신과'(진료과, 보호) vs '정신'+'과(접속)'(드묾). 노운 우세·고빈도 항목만 등재해 정당한 조사 절단을 막지 않도록 한다.; 과보호 위험: 학과(~학과)를 일괄 보호하면 '컴퓨터공학과→컴퓨터공학'처럼 바람직한 분야명 절단을 막는다. 진료과만 선별 보호해야 하며 경계 케이스를 테스트로 고정 필요.; 신규 사전 항목이 기존 true-positive 절단을 깨면 안 됨 — 양방향(절단 보존 + 절단 동작) 회귀를 함께 검증하지 않으면 조용한 퇴행 가능.; 실트래픽/실검색 코퍼스가 없어(키 없이 오프라인) 큐레이션이 정적 적대적 리스트에 의존 → 실제 쿼리 분포를 완전히 반영하지 못함. 무료·무카드 제약상 감수, 트래픽 확보 후 재검증.
**비용**: 비용 0. 순수 오프라인 코드+단위 테스트 변경으로 외부 API·LLM 호출 없음(Anthropic $8.8 예산·키 게이트·캐시·폴백 패턴에 무영향). 새 의존성 없어 번들/배포 비용 불변. CI 테스트만 추가 실행(무료).

### 2. 수집 소스 확장: 애플 앱스토어(iTunes) 어댑터 추가 (+ 공공데이터·플레이스토어는 게이팅)
`id: additional-sources-appstore-publicdata-m2` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: M2 소스 확장의 가장 비용 효율 높은 첫 슬라이스. 키 없이 즉시, 계약 변경 0으로 제품/채널 커버리지를 채운다.

**수용 기준**:
- createAppStoreAdapter({})가 키 없이 isEnabled()===true (requiresKey=false). registry.ts ADAPTERS 배열에 등록되어 getEnabledAdapters()에 항상 포함된다.
- collect()가 https://itunes.apple.com/search?term=<query>&country=kr&media=software&limit=<n> 를 safeFetch(allowHosts:['itunes.apple.com'], timeoutMs:5000)로 호출하고, results를 RawItem으로 매핑한다(trackName→title, trackViewUrl→url, description/지원 메타→snippet, sourceType:'appstore'). url이 http(s)가 아니거나 trackName/trackViewUrl 누락 항목은 제외.
- DATA-SOURCING §5의 보수적 레이트(~분당 15 이하) 준수: createRateLimiter로 게이트 + withRetry(shouldRetry=NETWORK/TIMEOUT만, 4xx 재시도 금지).
- 관련성 필터: 검색어 토큰이 trackName 또는 sellerName(아티스트/개발사)에 매칭되는 항목만 채택(무관 앱 노이즈 차단). 빈 결과/비-software 응답은 빈 배열 반환.
- 주입형 fetchImpl을 쓰는 단위 테스트(appstore.test.ts)가 kakao.test.ts 패턴으로: (a)키 없이 활성, (b)호스트·query 인코딩·country=kr·media=software 파라미터, (c)필드 매핑+HTML/빈값 처리, (d)관련성 필터, (e)transient 재시도를 검증. vitest 통과.
- 계약/하위 레이어 변경 0 확인: packages/shared·normalize.ts·web/lib/sources.ts·category-rules.ts 무수정으로 통과(appstore는 이미 정의됨). 기존 category-rules.test.ts(appstore→product) 그린 유지.
- pnpm lint && pnpm typecheck && pnpm test && pnpm build 그린. new any/console.log 없음, gitleaks 통과.
- ADR 1건 기록(docs/adr/0009-...): 앱스토어 P1 활성 + 플레이스토어 보류(ToS·공식 무료 API 부재) + 공공데이터 키 게이팅 결정의 대안·트레이드오프.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/sources/appstore.ts (신규 — wikipedia.ts/kakao.ts 패턴 복제)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/appstore.test.ts (신규 — kakao.test.ts 패턴)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts (ADAPTERS에 appStoreAdapter 등록)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/types.ts (SourceAdapter/RawItem 계약 — 무수정 참조)`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/http.ts (safeFetch allowHosts), /Users/kang/Desktop/cerebro/apps/api/src/lib/rate-limit.ts (createRateLimiter/withRetry)`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts (SOURCE_TYPES에 appstore/playstore 이미 존재 — 무수정)`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts (BASE_CONFIDENCE.appstore=0.65 이미 존재 — 무수정)`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/category-rules.ts (L112 appstore/playstore→product 라우팅 이미 존재 — 무수정)`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/sources.ts (SOURCE_TYPE_LABELS.appstore='앱스토어' 이미 존재 — 무수정)`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/orchestrator.ts (getEnabledAdapters 병렬 수집 — 무수정, 자동 편입)`, `/Users/kang/Desktop/cerebro/docs/DATA-SOURCING.md (§3.3 근거), /Users/kang/Desktop/cerebro/docs/STATUS.md·docs/adr/0009-*.md (갱신)`, `공공데이터 슬라이스 시: /Users/kang/Desktop/cerebro/apps/api/src/env.ts + /Users/kang/Desktop/cerebro/.env.example (DATA_GO_KR 서비스키 추가)`
**노력 근거**: 앱스토어 어댑터 슬라이스 단독은 S(<0.5d): 기존 어댑터(wikipedia~77줄·kakao~128줄) 복제 수준이고 계약·정규화·그래프 라우팅·UI 라벨이 전부 사전 배선되어 코드 변경면이 좁다(신규 2파일 + registry 1줄). 다만 후보가 묶은 공공데이터(키 발급+엔드포인트 선정+엔티티 매칭+PIPA 개인사업자 가드 ≈ 별도 M)와 정제 품질 개선까지 포함하면 전체는 L에 가깝다. 권고: 앱스토어를 먼저 단일 PR로 출시(S), 공공데이터는 키 확보 후 별 PR(M)로 분리.
**의존성**: 없음(앱스토어 슬라이스): 키 불필요·계약 사전배선 완료로 즉시 착수 가능; 공공데이터 슬라이스: 외부 선결조건 — data.go.kr 인증키 발급 + 대상 OpenAPI(예: 사업자/기업 기본정보) 엔드포인트 선정 필요; 플레이스토어: 공식 무료 API 부재·ToS 위반 리스크(DATA-SOURCING §3.7) → 합법 경로(공식/유료/파트너십) 확보 전 미수집
**리스크**: 플레이스토어 오해: 후보 제목은 '앱스토어/플레이스토어'지만 DATA-SOURCING 매트릭스·§3.7은 플레이스토어를 '보류(ToS 위험·공식 무료 API 없음)'로 명시. 우회 크롤링은 골든룰/ADR 위반 → 구현 금지, ADR로 보류 사유 고정 필요.; 엔티티 매칭 노이즈: iTunes 검색은 동명·무관 앱을 반환할 수 있어 관련성 필터(trackName/sellerName 토큰 매칭) 없으면 그래프에 엉뚱한 제품 노드 유입. country=kr로 한국 결과 편향 권장.; 레이트리밋: iTunes는 비공식 ~분당 20 가이드(§3.3/§5). 보수적 limiter+백오프 미적용 시 일시 차단 위험.; 공공데이터 PIPA: 사업자 정보에 개인사업자(자연인) 성명·소재지가 섞일 수 있음 → '공인·법인·공개정보 한정' 정책 + redactSensitive(pii.ts) 적용, 개인사업자 레코드 제외 가드 필요.; 공공데이터 신뢰도/타입: 정형 공공데이터를 기존 'official'(confidence 0.9, 라벨 '공식')에 매핑할지 새 'publicdata' SourceType을 추가할지 결정 필요 — 후자는 shared 계약 변경(YAGNI 관점에선 official 재사용 우선 검토).
**비용**: Anthropic 예산($8.8) 영향 0. 앱스토어/공공데이터는 LLM 이전 단계인 '수집 소스'로, 다운스트림 활용 리포트(report.ts)는 이미 키 게이트·30분 캐시·18건 상한(ADR-0008)으로 통제되어 소스 추가가 호출 횟수를 늘리지 않는다. 앱스토어 iTunes API=완전 무료·무키·무카드(ADR-0005 부합). 공공데이터=무료(키만 발급, 무카드). 추가 인프라 비용 없음.

### 3. 대표 시드 코퍼스(기업 20·공인 10) 그래프 렌더 일괄 검증 하니스 + M1 Exit① 게이트
`id: representative-seed-corpus-qa` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 동일

**수용 기준**:
- 시드 코퍼스 데이터가 존재: 기업 20 + 공인 10 = 30개를, 선정 기준 주석과 함께 데이터로 커밋(예: apps/api/src/qa/seed-corpus.ts). 공인은 PIPA 준수 — 공개정보·공인 한정, 민감정보(연락처·주소·주민번호·건강·정치성향 등) 0건. 시드 데이터에 개인 신상/시크릿 미포함.
- 재사용 가능한 순수 렌더-불변식 검증기(예: packages/shared/src/graph-invariants.ts)가 다음을 단언하고 단위 테스트됨: center 노드 정확히 1개 · 총 노드 ≥ 4(center+가지≥3, AC-1) · 모든 edge.source/target가 실재 노드 id 참조(댕글링 0) · 노드 id 중복 0 · GraphSnapshotSchema.safeParse 통과.
- web 레이아웃 테스트(apps/web/src/lib/layout.test.ts 신규)가 대표 시드 그래프에 대해 layoutGraph가 모든 노드에 유한한 [x,y,z](NaN/Infinity 0)를 반환하고, 모든 edge가 양끝 위치를 해석 가능(MindMapCanvas가 전부 렌더)함을 단언.
- 비차단 라이브 스모크 스크립트(apps/api/scripts/seed-corpus-smoke.ts, tsx 실행)가 30개 시드를 실제 활성 어댑터(wikipedia+naver)로 collectAll→buildGraphFromCollection 경유시켜 검증기를 적용하고 시드별 pass/fail 표를 출력. ANTHROPIC_API_KEY 미설정으로 실행해 1일 비용 $0 유지.
- 스크립트 종료코드: 30개 전부 렌더 가능하면 0, 아니면 실패 시드 표와 함께 비0. 이 스크립트는 차단 PR CI(.github/workflows/ci.yml)에 추가하지 않음(QA-STRATEGY §5.2 — 외부 의존·플래키는 온디맨드/nightly).
- 렌더 불변식을 위반한 시드는 트리아지: (a) 빈약 수집(nodes<4) 케이스는 폴백 보강으로 수정하거나 (b) 후속 이슈로 기록. ROADMAP §3 M1 Exit① 및 QA-STRATEGY L273 DoD에 실행 결과(날짜·통과 N/30) 갱신.
- pnpm lint·typecheck·test·build 그린 유지, gitleaks 통과, 새 any/console 잔여물 없음.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/docs/ROADMAP.md`, `/Users/kang/Desktop/cerebro/docs/QA-STRATEGY.md`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/orchestrator.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/graph.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/layout.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/components/MindMapCanvas.tsx`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/qa/seed-corpus.ts (신규)`, `/Users/kang/Desktop/cerebro/packages/shared/src/graph-invariants.ts (신규)`, `/Users/kang/Desktop/cerebro/apps/api/scripts/seed-corpus-smoke.ts (신규)`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/layout.test.ts (신규)`
**노력 근거**: 하니스 자체는 0.5~1d: 시드 목록 작성(~1h), 순수 검증기+단위테스트(~2h), web 레이아웃 불변식 테스트(~1h), 라이브 스모크 스크립트(~2h, collectAll/buildGraph 직접 호출이라 서버 기동 불필요), 문서 갱신(~0.5h). 단, 라이브 30종 실행에서 발견될 수 있는 렌더 끊김(빈약 시드 nodes<4 폴백 보강 등) 수정은 변동성이 있어 발견 건수에 따라 L로 번질 수 있다. 하니스 구축 자체를 스코프로 보면 M.
**의존성**: 진행 중 브랜치 feat/source-category-classifier(STATUS 백로그 #4): 그래프 가지 모양이 확정된 뒤 1회로 검증하는 편이 재실행 낭비가 적음(하드 블로커 아님, 먼저 머지 권장); NAVER 클라이언트 키(로컬 apps/api/.env에 이미 존재) + 위키백과(키 불필요) — 라이브 무료 소스 가용; (선택) LLM usage-graph 렌더 경로까지 검증하려면 ANTHROPIC_API_KEY — 기본 실행은 키 OFF로 $0 유지
**리스크**: 라이브 외부 의존(네이버/위키)은 날짜별로 결과가 변동·플래키 → 정확 라벨이 아닌 구조 불변식(개수·계약·유한좌표·댕글링)만 단언하고, 차단 PR CI가 아닌 온디맨드/nightly로 분리해야 함(QA §5.2 위반 방지); 실제 빈약 시드가 nodes 2~3개를 내면 AC-1 위반인데 server.ts는 nodes<=1에서만 mock 폴백 → 진짜 버그가 드러나 추가 수정 필요(폴백 임계 상향 또는 가지 보강). 스코프 확장 가능; PIPA: 공인 10명 선정 시 공개정보·공인 한정, 민감정보 금지. 잘못된 인물/사적정보 선정은 정책 위반 → 선정 기준을 데이터에 인코딩하고 리뷰 필요; 네이버 일일 쿼터(25k콜, 전 엔드포인트 공유) 내 30종×다중엔드포인트 호출은 충분하나, 반복 실행 시 캐시 없이 누적 — 스크립트는 1회성/저빈도로 운용; Anthropic 예산: 키를 켠 채 30종 전부 돌리면 ~$0.9~1.5 소모. 기본은 키 OFF로 $0, LLM 경로는 소수 시드만 스팟 체크
**비용**: 기본 실행 = $0. 네이버+위키백과는 무료 쿼터(무카드, ADR-0005 무료 원칙 부합)이고, ANTHROPIC_API_KEY를 미설정으로 두면 report.ts:127에서 null 반환→휴리스틱 그래프로 폴백해 Claude 호출 0. 렌더 게이트는 경로 무관(휴리스틱/usage 그래프 모두 같은 불변식)이라 키 OFF로 충분히 검증된다. usage-graph 렌더 경로까지 보려면 시드 1~2개만 키 ON(~$0.03~0.05/건, 캐시로 재실행 0). 30종 전부 키 ON은 ~$0.9~1.5($8.8 중)로 게이트엔 불필요.

### 4. 그래프 토픽 → 엔티티 해석 고도화 (휴리스틱 콜로케이션 + 별칭 병합)
`id: graph-entity-resolution` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 현재 concept(가지) 노드는 공백 분리 단일 토큰의 빈도로만 만들어진다(extractTopics→buildConceptNodes). 한국어 조사 분리(ADR-0004)는 됐지만 다중 토큰 개체("삼성"+"전자", "간편"+"결제")가 파편화되고, 영문/한글·약어 등 동일 개체의 표면 변형이 별개 노드로 흩어져 가지 품질이 낮다. 다중 토큰 개체 복원 + 표면 변형 병합으로 무키(無LLM) 폴백 그래프(=지출 0 기본 경험)의 신호 대비 노이즈를 개선한다. 외부 API·LLM 없이 의존성 0 휴리스틱으로 가능해 무료·무카드(ADR-0005)와 예산($8.8) 제약에 정확히 부합한다.

**수용 기준**:
- 콜로케이션 병합: 같은 항목들에서 인접해 반복 등장하는 두 토큰이 임계치(예: 최소 2개 출처 공기) 이상이면 단일 다중어 concept('간편결제')로 묶이고, 파편 토큰('간편','결제') 각각보다 상위 가중치를 가진다 — score 테스트로 검증
- 별칭 정규화: korean.ts에 좁게 큐레이션된 canonical 맵을 추가해, 동일 개체의 표면 변형 2종이 하나의 Topic으로 sourceIds가 합쳐져 집계됨을 단위 테스트로 검증(개방 클래스 한계는 ADR로 명시)
- 토큰 인접성 보존: normalize의 unique()가 인접 정보를 파괴하므로, 콜로케이션 계산용 항목별 순서 토큰을 보존하는 변경을 가하되 기존 NormalizedItem.tokens(중복제거) 소비자(extractTopics 기존 경로)는 깨지지 않음 — pipeline.test.ts 기존 테스트 전부 그린
- buildGraphFromCollection(분석 없음=휴리스틱 경로)에서 생성된 concept 노드에 동일 개체 파편 중복이 없음을 검증하는 build 테스트 추가(병합된 개체가 별도 파편 노드로 동시 노출되지 않음)
- 오버머지 가드: 임계치 미만이거나 보호 단어/불용어가 끼면 병합하지 않음을 음성 케이스 테스트로 고정(false compound 차단)
- pnpm typecheck && pnpm test && pnpm lint && pnpm build 전부 그린, 새 런타임 의존성 0, 새 any/console 잔여물 없음
- ANTHROPIC 호출·외부 API 호출이 추가되지 않음(diff에 네트워크 호출 없음) — 지출 0 유지
- 트레이드오프를 docs/adr/0009-*.md 5~15줄로 기록(콜로케이션·별칭 사전의 개방 클래스 한계, 형태소 분석기 미도입 근거)

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/collect/score.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/korean.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/pipeline.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/korean.test.ts`, `/Users/kang/Desktop/cerebro/docs/adr/0009-entity-resolution-heuristic.md`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 핵심 변경은 apps/api 내부 3~4파일에 국한된다(score.ts 콜로케이션 로직 신규, normalize.ts에 항목별 순서 토큰 보존, korean.ts 별칭 맵, build.ts 소비 연결). shared 계약(Topic은 score.ts 내부 타입, 그래프 스키마 불변)·web·DB 변경 불필요. 다만 normalize의 unique()가 인접성을 파괴해 순서 토큰 보존을 위한 자료구조 변경 + 콜로케이션 임계치 튜닝 + 음성/양성 테스트 작성이 필요해 S를 넘어선다. 별칭 사전을 넓히면 L로 번질 수 있어 MVP는 좁은 큐레이션으로 M에 고정.
**의존성**: 선결조건 없음(외부 키·승인·트래픽 불필요, 전부 로컬·무료); 관련(차단 아님): ADR-0004 한국어 조사 토큰화 — 동일 korean.ts 영역, 동일한 '개방 클래스 사전' 트레이드오프 패턴 재사용; 주의: LLM 키 설정 시 buildUsageGraph가 concept 노드를 대체하므로 이 개선의 가시 효과는 무키 폴백 경로에 한정 — graph-usage-report 계열 작업과 표시 경로가 직교
**리스크**: 오버머지(false compound): 인접 빈도가 우연히 높은 토큰쌍이 잘못된 복합어로 묶일 수 있음 → 임계치(최소 출처 공기 수)+보호단어/불용어 가드+음성 테스트로 완화; 별칭 사전은 개방 클래스라 유지보수 불완전(ADR-0004 PROTECTED_WORDS와 동일 한계) → 고가치 소수 항목만 큐레이션하고 ADR에 한계 명시; 가시 효과 제한: concept 노드는 무키/LLM실패 폴백 경로에서만 렌더(키 설정 시 usage 그래프가 대체) → 우선순위는 now가 아닌 next가 타당; 인접성 보존을 위한 NormalizedItem 변경이 기존 extractTopics/dedup 소비자에 회귀를 유발할 수 있음 → 기존 tokens 필드 유지(추가 필드 방식)로 무중단, 기존 pipeline 테스트 전량 통과로 가드
**비용**: 지출 0. 순수 휴리스틱(콜로케이션 빈도 + 좁은 별칭 맵)으로 Anthropic·외부 검색 API 호출을 일절 추가하지 않음 → $8.8 예산 무영향, 무카드(ADR-0005) 부합. 오히려 이 작업이 개선하는 concept 경로 자체가 키 없을 때의 $0 폴백 그래프라 비용 통제 철학과 일치. 새 런타임 의존성도 추가하지 않음(형태소 라이브러리 kiwi-nlp 보류 유지).

### 5. axe 접근성 자동 검사 (component-level vitest-axe + reduced-motion/키보드 고정)
`id: axe-accessibility-tests` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: QA-STRATEGY DoD/M1 Exit가 요구하는 접근성 자동 검증이 현재 0이고 reduced-motion은 회귀 감지 불가 상태라, 무료·기존 게이트로 빠르게 고정 가능.

**수용 기준**:
- devDep로 `vitest-axe`(axe-core 번들) 추가, `apps/web/src/test/setup.ts`에 `expect.extend` 매처 + `window.matchMedia` 모킹 등록. 새 테스트는 기존 `pnpm test`(=`pnpm -r run test` → web `vitest run`) PR 게이트에서 자동 실행되며 별도 CI 잡 불필요.
- 신규 `apps/web/src/test/a11y.test.tsx`가 DOM 레이어 표면 각각(idle hint, SearchBar, error 상태 role=alert, CerebroLoader, 시드 노드+출처를 가진 DetailPanel, SourceSummary, CategoryLegend)을 렌더하고 `expect(await axe(container)).toHaveNoViolations()`로 impact=critical|serious 위반 0을 단언. WebGL인 MindMapCanvas는 스캔 대상에서 제외(jsdom 미지원, QA §6.1).
- reduced-motion 폴백 고정: `CerebroLoader`(또는 작은 `useReducedMotion` JS 게이트)가 `matchMedia('(prefers-reduced-motion: reduce)')` matches=true(모킹) 시 정적 폴백을 렌더하고 애니메이션 silhouette를 마운트하지 않음을, matches=false 시 모션 버전을 마운트함을 RTL로 양분 단언(QA §4 AC-2 매핑). 기존 CSS 폴백은 belt-and-suspenders로 유지.
- 키보드 조작: @testing-library/user-event로 마우스 없이 검색어 input→탐색 버튼 포커스 이동·제출, DetailPanel 닫기 버튼 도달이 가능함을 단언(QA §7.2 '마우스 없이 핵심 루프').
- 명도대비(color-contrast) NFR 처리 결정 기록: jsdom axe는 layout이 없어 color-contrast 룰을 평가 못 함. (a) `apps/web/src/lib/colors.ts`의 NODE_COLORS·배경 토큰에 대한 결정적 WCAG 대비비 단위 테스트(≥4.5 일반/≥3.0 큰 글자)를 추가하거나, (b) Playwright 후속으로 명시 연기 — 둘 중 하나를 QA-STRATEGY/ADR에 기록.
- `docs/QA-STRATEGY.md`(§7.2/§12)와 `docs/STATUS.md`를 갱신해 axe 접근성 = 컴포넌트 레벨 완료 / 브라우저 레벨(실 color-contrast·실 미디어 reduced-motion·E2E 키보드)은 Playwright 후속임을 명시.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 그린, 신규 `any`/시크릿 없음.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/web/package.json`, `/Users/kang/Desktop/cerebro/apps/web/src/test/setup.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/test/a11y.test.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/CerebroLoader.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/DetailPanel.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/index.css`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/colors.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/colors.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/vite.config.ts`, `/Users/kang/Desktop/cerebro/docs/QA-STRATEGY.md`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 기존 vitest+jsdom+RTL 인프라 재사용이라 신규 하네스 부트스트랩 없음(S에 가깝지만): vitest-axe 도입+setup 확장, 7개 표면 스윕 테스트, reduced-motion JS 게이트 리팩터+양분 테스트, 키보드 테스트, (선택)대비 단위 테스트, 문서 갱신까지 합치면 0.5~1.5d. 풀 Playwright+@axe-core/playwright(실 color-contrast·emulateMedia·E2E 키보드·CI 잡·WebGL 처리)까지 묶으면 L로 커지므로 그 부분은 의도적으로 분리.
**의존성**: (소프트) Playwright E2E 하네스 — 실 color-contrast·실 미디어 reduced-motion·브라우저 키보드 E2E는 Playwright 필요하나 현재 playwright.config 없음. 본 후보의 vitest-axe 슬라이스는 이에 의존하지 않음(독립 착수 가능).
**리스크**: jsdom axe는 layout 부재로 color-contrast 룰을 스킵 → 명도대비 NFR은 vitest-axe만으로 미충족. 정적 대비 단위 테스트 또는 Playwright 후속으로 보완 필요(핵심 트레이드오프).; MindMapCanvas(WebGL)는 jsdom 미지원·headless 제한(QA §6.1) → 3D 캔버스 자체의 접근성은 자동 스캔 불가, DOM 오버레이 상태만 커버.; reduced-motion을 CSS→JS matchMedia 게이트로 옮기면 약간의 복잡도 추가. SSR/matchMedia 미존재 가드 필요, 기존 CSS 폴백은 유지해 실사용 회귀 방지.; 스코프가 풀 Playwright 하네스로 번지면 L로 커지고 두 관심사(E2E 도입 vs axe)가 결합됨 → 본 후보는 컴포넌트 레벨로 한정.; axe는 비동기 콘텐츠 미정착 시 플래키 가능 → 정적 컴포넌트 렌더 후 await로 정착 보장(리스크 낮음).
**비용**: $0. Anthropic API 무관(키 게이트·캐시·폴백 패턴에 영향 없음). vitest-axe/axe-core는 무료 OSS, 카드 불필요(ADR-0005 부합). 기존 vitest 게이트에 테스트만 추가하므로 CI 분 증가 미미. 풀 Playwright 단계로 갈 경우에만 Chromium 다운로드로 CI 분 증가(공개 저장소 무료).

### 6. YouTube Data API v3 소스 어댑터 (키 게이트·무료·영상 커버리지)
`id: youtube-data-api-adapter` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 가치: 영상(리뷰/인터뷰/채널) 커버리지로 마인드맵의 출처 다양성 확대, 합법·무료·무카드 원칙 유지.

**수용 기준**:
- isEnabled() 키 게이트: createYoutubeAdapter({}).isEnabled() === false, createYoutubeAdapter({apiKey:'k'}).isEnabled() === true (kakao.test.ts와 동일 패턴 단위테스트)
- 비활성 어댑터: createYoutubeAdapter({}).collect({query:'x'}) 가 네트워크 호출 없이 [] 반환
- 인증 방식 검증: 주입한 fetchImpl이 받은 URL이 https://www.googleapis.com/youtube/v3/search 이고 API 키가 헤더가 아닌 쿼리파라미터 key= 로 전달됨(네이버/카카오의 헤더 인증과 다름) — 단위테스트로 assert
- 매핑 검증: 응답 items[].id.videoId → url=https://www.youtube.com/watch?v={videoId}, snippet.title/description는 stripHtml 적용, snippet.publishedAt는 ISO 8601로 파싱, type=video 파라미터로 채널/재생목록 제외
- registry.ts ADAPTERS에 등록되어 getAllAdapters()에 포함되고, 키 미설정 시 getEnabledAdapters()에서 자동 제외됨
- 보안: API 키가 어떤 로그/에러 메시지에도 평문 노출되지 않음(safeFetch가 키 포함 전체 URL을 로깅하지 않음 확인)
- 전체 게이트 그린: pnpm typecheck && pnpm test && pnpm lint && pnpm build (Option A 선택 시 web sources.test.ts의 '모든 출처 유형에 한국어 라벨 존재' 통과 = SOURCE_TYPE_LABELS에 신규 유형 라벨 추가됨)
- (라이브, 키대기·선택) 실제 YOUTUBE_API_KEY 주입 시 영상성 쿼리에 대해 /api/search 응답 graph.sources에 영상 유형 출처가 포함됨

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/sources/youtube.ts (신규 — kakao.ts를 템플릿으로, 단 쿼리파라미터 key= 인증)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/youtube.test.ts (신규 — kakao.test.ts 미러)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts (L15 ADAPTERS 배열에 youtubeAdapter 추가)`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts (L20-26 키 블록에 YOUTUBE_API_KEY: optionalSecret 추가)`, `/Users/kang/Desktop/cerebro/.env.example (YOUTUBE_API_KEY= 빈 플레이스홀더 + 출처 라인 갱신)`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts (L23-34 SOURCE_TYPES에 'video' 추가 — Option A, SSOT 먼저)`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/sources.ts (SOURCE_TYPE_LABELS에 video: '영상' 추가 — Option A)`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts (BASE_CONFIDENCE에 video 항목 추가 — 선택, 미추가 시 0.5 폴백)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/types.ts (참고 — RawItem에 author 필드 없음. channelTitle을 담으려면 RawItem+normalize 확장 필요, 아니면 snippet에 접두로 포함하거나 생략)`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/orchestrator.ts (참고 — 변경 불필요. L41이 raw.sourceType ?? adapter.sourceType로 이미 처리)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md (§1 소스 어댑터 표 + §5 백로그 8번 갱신)`, `/Users/kang/Desktop/cerebro/docs/adr/0007-social-community-sources.md (YouTube 도입 반영 — 표에 ✅ 구현됨 표기, 또는 짧은 후속 ADR)`
**노력 근거**: 어댑터 본체+단위테스트는 kakao.ts/kakao.test.ts 템플릿 재사용으로 거의 기계적(S 수준). M으로 올라가는 요인: (1) 인증이 헤더가 아닌 쿼리파라미터 key= 라 템플릿을 그대로 못 쓰고 키 노출 방지를 별도 확인해야 함, (2) 출처 투명성('영상' 배지)을 위해 SOURCE_TYPES를 shared(SSOT)→web 라벨→web 테스트로 교차 패키지 변경 필요(CLAUDE.md: 계약은 shared 먼저), (3) env+.env.example+registry 배선, (4) STATUS/ADR 문서 갱신 + 전 패키지 typecheck. 'sns' 기존 유형 재사용(Option B, 계약 변경 0)이면 S(<0.5d)로 떨어진다.
**의존성**: 외부 선결조건(라이브 한정): Google Cloud 프로젝트에서 'YouTube Data API v3' 사용설정 후 API 키 발급(무료·카드 불요). 단 코드+단위테스트는 주입 fetchImpl로 키 없이 완성·검증 가능 → 머지는 키에 의존하지 않음(kakao '키대기'와 동일 패턴); 외부 검증 필요: 구글 신규고객 영구차단은 Custom Search JSON API 한정(ADR-0005)이며 YouTube Data API v3는 별개 API로 ADR-0007에서 ✅ 검증됨. 다만 동일 구글 계정 정책 변동 가능성 → 키 실제 발급 가능 여부를 라이브 활성 전 1회 확인; 다른 후보 id 의존성 없음
**리스크**: API 키가 URL 쿼리파라미터(key=)로 들어가므로 로그/에러에 평문 노출 위험. safeFetch는 HOST_NOT_ALLOWED 시 host만, URL 파싱 실패 시 rawUrl을 메시지에 포함(http.ts L66) — 정상 구성 URL은 파싱 실패하지 않지만, 어댑터 자체 로깅에서 전체 URL을 찍지 않도록 주의(시크릿 골든룰); 쿼터: search.list는 호출당 100 units, 기본 일일 10,000 units → 약 100 고유 검색/일. 네이버(25k콜)·카카오보다 빡빡함. 다만 단일 엔드포인트(쿼리당 1콜)+기존 30분 캐시로 완화, 초과 시 allSettled로 graceful degrade(다른 소스 계속); type=video 미지정 시 채널/재생목록이 섞여 노이즈 발생 → part=snippet&type=video로 제한 필요; RawItem에 author 필드 부재(types.ts) — 채널명(channelTitle)을 출처에 담으려면 RawItem+normalize 확장 필요. YAGNI상 MVP는 생략 또는 snippet에 포함 권장(스코프 폭주 방지); PIPA: 영상 제목/설명에 개인 식별정보 유입 가능 → normalize()의 redactSensitive(pii.ts)가 자동 적용되나 best-effort. '공인·공개정보 한정' 정책이 1차 방어, 민감정보 미수집 유지; SOURCE_TYPES 'video' 추가 시 web sources.test.ts(L18 모든 유형 라벨 존재)와 Record<SourceType,string> 타입이 라벨 누락을 즉시 검출 → 라벨 추가 누락 방지(리스크 낮음, 오히려 안전망)
**비용**: Anthropic 예산 $8.8에 영향 0 — 이 작업은 데이터 소스 어댑터로 LLM 호출이 전혀 없음(활용 리포트와 분리). YouTube Data API v3는 무료 쿼터(10,000 units/일, 카드 불요)로 ADR-0005 무료·무카드 원칙 준수. 키 게이트(isEnabled)+30분 캐시로 비용/쿼터 통제, 키 미설정 시 완전 비활성(지출·호출 0). 쿼터 초과는 allSettled 폴백으로 안전 degrade.

### 7. 모바일 3D 품질 자동 저하 폴백 (AC-8)
`id: mobile-3d-quality-fallback` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

📝 **최신화(PR #22)**: 시네마틱 Bloom(@react-three/postprocessing v2)이 도입됨 → 저사양 폴백에 **모바일 Bloom 비활성/저감**을 포함할 것(메모리: postprocessing은 v2 고정, v3 금지).

**왜**: ROADMAP M1 핵심산출물 ⑥ + Exit ②(중급 모바일 < 3s, 60fps 지향)와 QA AC-8을 충족하는 마지막 미구현 M1 항목 중 하나. 현재 apps/web/src에는 품질 저하 로직이 전무하다 — MindMapCanvas는 기기와 무관하게 모든 노드를 sphereGeometry(32×32) + pointLight 2개 + hover 스케일로 고정 비용 렌더한다. 저사양/모바일에서 프레임 드랍·발열·탐색 불가 위험이 있고, 이는 무료 MVP의 핵심 경험(3D 마인드맵)을 모바일 유입에서 깨뜨린다. 비용 $0(순수 프론트, API/LLM/키 무관)로 모바일 탐색 가능성을 확보한다.

**수용 기준**:
- 순수 함수 selectQualityProfile(signals)를 신규 추가: 입력은 주입 가능한 신호 객체(deviceMemory, hardwareConcurrency, pointerCoarse, viewportWidth, prefersReducedMotion 등)이고, 반환은 QualityProfile { tier:'high'|'low', maxNodes, dpr, sphereSegments, pointLights, antialias, enableHoverScale, edgeOpacity }. jsdom에 matchMedia가 없으므로 코어는 매체 API를 직접 호출하지 않고 신호 주입만 받는다(실신호 수집은 얇은 어댑터로 분리).
- Vitest 단위 테스트(apps/web/src/lib/quality.test.ts): 저사양 신호(예: deviceMemory<=4 또는 hardwareConcurrency<=4 또는 pointerCoarse 또는 viewportWidth<768 또는 prefersReducedMotion=true) → low tier(maxNodes 축소·dpr 1 상한·sphereSegments 축소·pointLights=1·antialias=false·enableHoverScale=false) 반환, 데스크톱 신호 → high tier 반환을 단언.
- MindMapCanvas.tsx가 QualityProfile을 소비: Canvas dpr=profile.dpr, sphereGeometry args의 세그먼트=profile.sphereSegments, 색 보조 pointLight는 high tier에서만 렌더, hover/selected 스케일·emissive 강조는 enableHoverScale에 따름. 렌더 노드는 center 항상 유지 + importance 내림차순으로 profile.maxNodes까지로 제한하고, 드롭된 노드를 가리키는 edge는 렌더되지 않으며 크래시가 없다(기존 edgeLines null 필터로 보장).
- prefers-reduced-motion=reduce 시 low/정적 tier로 폴백(hover 스케일·모션 효과 비활성)하여 AC-2와 정합. 기존 index.css reduced-motion 블록과 충돌 없음.
- 회귀 없음: 기존 App.test.tsx 통과 + 신규 테스트 통과, pnpm lint·typecheck·test·build가 CI에서 그린.
- (E2E 절반, 트리거 대기) Playwright 모바일 에뮬레이션(예: 390×844, pointer coarse)에서 검색→그래프 렌더 후 노드 탭(선택)이 동작. Playwright 하니스가 레포에 부재하므로 이 항목은 별도 E2E 부트스트랩 선결 후 충족.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/web/src/lib/quality.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/quality.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/components/MindMapCanvas.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/index.css`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts`, `/Users/kang/Desktop/cerebro/docs/QA-STRATEGY.md`, `/Users/kang/Desktop/cerebro/docs/adr/`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 실질 작업은 (1) 순수 selectQualityProfile 셀렉터 + 단위 테스트, (2) MindMapCanvas 배선(dpr·세그먼트·라이트·노드 캡·hover 효과)으로 한정되며 신규 의존성 0, API/계약 변경 0. 기존 edge null 필터가 노드 캡의 안전성을 이미 보장해 위험이 낮음. 다만 tier 임계값 튜닝 + 라이트/다크·대형 그래프 수동 시각 QA가 필요해 S(<0.5d)보다는 큼. AC-8의 E2E 절반은 Playwright 부재로 본 작업 범위 밖(별도)이라 M(0.5~1.5d) 상단이 아닌 중간으로 본다.
**의존성**: 외부 선결조건(AC-8 E2E 절반 한정): Playwright/E2E 하니스가 레포에 미설치 — apps/web devDependencies·playwright.config·e2e 디렉토리 모두 부재. 단위+배선 절반은 이 의존성 없이 즉시 가능.; in-progress: feat/source-category-classifier(STATUS 백로그 #4, NodeKind 색 분류) — 머지 후 작업하면 MindMapCanvas 충돌 회피에 유리(하드 블록 아님).
**리스크**: jsdom에 matchMedia/WebGL 컨텍스트가 없음 → 셀렉터 코어를 순수 함수(신호 주입)로 유지하고 단위 테스트에서 gl/matchMedia를 직접 호출하지 않아야 함(실신호 수집 어댑터는 비테스트 또는 경량 모킹).; 과도한 저하가 데스크톱/중급 기기 UX를 해칠 수 있음 → tier 임계값은 보수적 기본값 + 라이트/다크·모바일/데스크톱·빈/대형 그래프 수동 시각 QA(QA-STRATEGY §6.2 체크리스트)로 검증.; 노드 캡이 한 branch의 자식을 드롭해 고아 가지가 생길 수 있으나 edgeLines가 좌표 없는 endpoint를 이미 필터하므로 크래시는 없음(importance 정렬로 center=1.0 항상 유지).; AC-8 'E2E(에뮬)' 완전 충족은 Playwright 부트스트랩이 선결 — 본 후보만으로는 AC-8의 E2E 단언을 완료할 수 없음(별도 후보 권장).; 트레이드오프(품질 tier 도입)는 ADR 5~15줄 기록 필요(코딩표준 규칙).
**비용**: $0 — 순수 프론트엔드 렌더 최적화로 외부 API·LLM·키 호출이 전혀 없어 Anthropic 예산($8.8)·무료티어 쿼터에 영향 없음. 오히려 저사양 기기 자원 사용을 줄여 운영상 이득.

### 8. 3D 인캔버스 노드 라벨 + 키보드 내비게이션 접근성
`id: 3d-node-labels-keyboard-nav` · 노력 **L(큼)** · 🟢 착수 가능 · tier:next

📝 **최신화(PR #22)**: 인캔버스 노드 라벨(글래스 타일, AC-1)은 이미 구현됨 → 이 항목의 잔여 범위는 **키보드 내비게이션·스크린리더 a11y**(마우스 없이 핵심 루프 완주) + 회전 시 occlusion 페이드 + 모바일 Bloom 저감.

**왜**: 3D 마인드맵이 마우스 전용이라 키보드/스크린리더 사용자가 핵심 루프(검색→노드 선택→상세)를 완주할 수 없고, 인캔버스 라벨 부재로 구체가 무엇인지 클릭 전엔 알 수 없다. ADR-0006이 명시적으로 미룬 후속이며 QA-STRATEGY §7.2와 AC-1/3/4 자동검증 미충족 항목을 동시에 닫는 실질 a11y 갭이다.

**수용 기준**:
- 키보드만으로 핵심 루프 완주: Tab으로 그래프 영역 진입 → 방향키(또는 Tab)로 노드 포커스 순회 → Enter/Space로 선택 시 DetailPanel(role=dialog)이 열림 → Escape로 닫히고 포커스가 직전 포커스 노드로 복귀. RTL(@testing-library/user-event)로 keydown 시 onSelect가 해당 노드로 호출되고 패널이 마운트/언마운트됨을 단언(jsdom은 WebGL을 렌더하지 않으므로 키보드 핸들링은 DOM 접근성 레이어 위에 구현해 테스트 가능해야 함)
- 노드 순회 순서가 결정적: 새 순수 함수(예: nav-order)가 graph→정렬된 노드 id 배열을 반환하고(중심→가지→잎, layoutGraph와 일관) 같은 입력=같은 출력임을 Vitest로 단언
- 인캔버스 라벨 노출: 검색 결과 그래프에서 노드 라벨 텍스트가 화면(3D 캔버스 또는 동기화된 접근성 DOM 레이어)에 노출되어 AC-1(라벨 ≥4)을 만족. 라벨은 node.label을 사용(공개정보 한정, 신규 데이터 수집 없음)
- 포커스/선택 시각 피드백: 포커스된 노드와 선택된 노드가 hover와 구분되는 emissive/scale 강조를 받고, 접근성 레이어의 포커스 요소에 가시적 focus-visible 링이 보임(키보드 한정)
- DetailPanel 포커스 관리: 패널 열림 시 포커스가 패널 내부(닫기 버튼 또는 제목)로 이동, Escape 및 닫기 버튼으로 닫힘, 닫힌 뒤 트리거 노드로 포커스 복귀. RTL로 단언
- OrbitControls와 키 충돌 없음: 방향키가 카메라 팬으로 가로채이지 않음(드리 OrbitControls keyEvents는 기본 비활성 — 활성화하지 않음으로 보장)
- reduced-motion 존중: prefers-reduced-motion 시 라벨 빌보드/카메라 보간 등 부가 모션 비활성(기존 index.css 패턴과 정합)
- 회귀 게이트 통과: pnpm typecheck && pnpm test && pnpm lint && pnpm build 그린, 신규 any/console 없음. 가능하면 axe(vitest-axe) 또는 RTL로 접근성 레이어 critical/serious 0 위반

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/web/src/components/MindMapCanvas.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/DetailPanel.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/layout.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/nav-order.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/nav-order.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/components/MindMapCanvas.test.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/DetailPanel.test.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/index.css`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/colors.ts`, `/Users/kang/Desktop/cerebro/docs/adr/0009-incanvas-labels-keyboard-nav.md`
**노력 근거**: 순수 프론트 작업이지만 별개의 하위 기능 4개를 묶는다: (1) 인캔버스 라벨, (2) 키보드 roving 내비, (3) DetailPanel 포커스 트랩/Escape/복귀, (4) 결정적 nav-order + RTL/단위 테스트. 핵심 난점은 R3F+jsdom 제약: jsdom은 WebGL을 렌더하지 않아(vitest config environment: jsdom, css:false 확인) 키보드/라벨을 WebGL에만 두면 CI에서 검증 불가 → 테스트 가능한 접근성 DOM 레이어(roving tabindex)와 시각 레이어(drei Text/Html)를 동기화하는 설계가 필요해 단순 핸들러 추가 이상의 구조 작업이다. 라벨 렌더 방식(troika 기반 drei Text vs drei Html 오버레이)과 성능 절충 결정으로 ADR 1건 작성도 포함. 라벨만(M)·키보드+포커스만(M)으로 분할 가능하나 후보가 둘을 묶었고 상호 의존(포커스 노드 강조)이라 L로 본다.
**의존성**: 없음(차단 의존 없음). drei 9.122(설치됨)가 Text(troika-three-text 0.52.4 전이의존 설치 확인)·Html·Billboard를 제공 → 신규 런타임 의존성 0; 선택(비차단): 씬그래프 단언을 원하면 @react-three/test-renderer(무료 dev dep) 추가 — QA-STRATEGY §6.2 권장. 미설치 상태이며 없어도 RTL+순수함수로 핵심 검증 가능하므로 필수 아님; 선택(비차단): 풀 키보드 E2E는 Playwright(QA-STRATEGY §7.2, 미설치, 'M1 후반' 항목) — 이번 범위 밖, 후속 잡으로 분리 권장
**리스크**: drei Text(troika)는 노드마다 SDF/워커를 생성해 대형 그래프 성능 저하 가능 → 라벨 LOD(중심+가지 상시, 잎은 포커스/호버 시) 또는 Html+sr-only 대체 필요; jsdom은 WebGL 미렌더 → 키보드/라벨을 캔버스 mesh에만 구현하면 CI 검증 불가. 테스트 가능한 접근성 DOM 레이어 위에 키 핸들링을 둬야 함; drei OrbitControls keyEvents는 기본 비활성(타입 확인). 활성화하지 않아 방향키 카메라 가로채기 없음을 유지; 라벨 텍스트가 배경(#05070f)과 노드 색 위 양쪽에서 WCAG AA 대비 충족 필요(외곽선/반투명 배경 패널); DetailPanel 포커스 트랩 도입 시 SourceSummary·CategoryLegend 등 오버레이와 탭 순서 충돌 주의
**비용**: 비용 영향 0. 순수 프론트엔드 작업으로 Anthropic API·외부 네트워크 호출 없음(예산 $8.8 무관, LLB 키 게이트/캐시 패턴과 무관). node.label 등 기존 공개정보만 표시해 신규 데이터 수집 없음(PIPA 영향 없음). 신규 유료 의존성 없음 — drei의 Text/Html은 이미 설치된 9.122에 포함(무카드 원칙 준수).

### 9. 캐시·쿼터·LLM비용 모니터링 (in-memory 계측 + /api/metrics + 임계 플래그)
`id: cost-quota-monitoring-dashboard-m2` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: M2→M3 게이트(ROADMAP §4.1 비용압박 80%) 측정 근거 확보 + 라이브 Anthropic 예산($8.8) 보호. 현재 계측 전무.

**수용 기준**:
- GET /api/metrics 가 MetricsSnapshotSchema(zod, packages/shared)를 만족하는 JSON 반환: cache{hits,misses,hitRate}, externalCalls(호스트별 ko.wikipedia.org/openapi.naver.com/dapi.kakao.com 카운트), anthropic{calls,inputTokens,outputTokens,estCostUsd}, quota{naver:{used,limit,ratio,warn}, kakao:{...}, anthropicBudget:{usedUsd,limitUsd,ratio,warn}} — 응답을 SearchResponse처럼 스키마로 parse 검증.
- 캐시 카운트 검증: fixture 어댑터+주입 metrics로 동일 쿼리 1회+재요청 1회 → misses=1, hits=1, hitRate=0.5 (server.test.ts 패턴의 app.inject로 단언).
- 임계 플래그: QUOTA_WARN_RATIO(=0.8 상수, 매직넘버 금지) 기준 limit=10·used=8 → warn=true, used=7 → warn=false 단위테스트.
- 인스턴스 격리: createMetrics()/buildServer()를 둘 만들면 카운트가 공유되지 않음(cache.test.ts·server.test.ts의 격리 패턴 준수).
- Anthropic 비용 산식: estCostUsd = inputTok×rateIn + outputTok×rateOut (Sonnet 4.6 단가 상수, claude-api 스킬로 단가 확인 후 고정). mock usage로 산술 단언, 키 미설정(폴백) 시 anthropic.calls=0.
- 엔드포인트 게이트: METRICS_TOKEN 설정 시 토큰 불일치→401, 일치→200; production에서 미설정 시 비활성(404). app.inject 헤더 유무로 검증.
- PII/PIPA: 스냅샷에 query 텍스트·검색주체·개인정보가 없음(집계 카운트만). 테스트로 응답에 'query' 키 부재 단언.
- 게이트 통과: pnpm typecheck && test && lint && build 그린, 신규 런타임 의존성 0(in-memory).

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/metrics.ts (신규 MetricsSnapshotSchema — SSOT 먼저)`, `/Users/kang/Desktop/cerebro/packages/shared/src/index.ts (re-export)`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts (QUOTA_WARN_RATIO, NAVER_DAILY_QUOTA=25000 등 상수)`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/metrics.ts (신규 createMetrics() 레지스트리: 카운터·일자버킷·ratio 계산)`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/metrics.test.ts (신규)`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/http.ts (safeFetch에 선택적 onRequest/host 카운트 훅 — 외부호출 단일 choke point)`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts (metrics 주입·캐시 hit/miss 집계·/api/metrics 라우트·토큰 게이트)`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.ts (res.usage 토큰·호출수 기록 — Anthropic은 safeFetch 미경유)`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts (NAVER_DAILY_QUOTA·KAKAO_DAILY_QUOTA·ANTHROPIC_BUDGET_USD·METRICS_TOKEN 추가)`, `/Users/kang/Desktop/cerebro/apps/api/src/server.test.ts (엔드포인트·카운트 통합 테스트 확장)`, `/Users/kang/Desktop/cerebro/apps/web/src/components/MetricsPanel.tsx (선택: 얇은 읽기전용 패널) + /Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/docs/adr/0009-in-memory-cost-metrics.md (신규 ADR: in-memory vs 영속·게이트 트레이드오프)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md (백로그 갱신)`
**노력 근거**: 백엔드 핵심(shared 스키마 + lib/metrics 레지스트리 + safeFetch/report.ts/server.ts 3곳 계측 + 단위·통합 테스트 + env + ADR)은 0.5~1.5d 범위의 M. 계측 지점이 명확하고(외부호출은 safeFetch 단일 choke point, 캐시는 server.ts 호출부, Anthropic은 report.ts res.usage) 신규 의존성·외부 연동이 없어 복잡도가 낮다. 단, '대시보드' UI를 풀로 만들면(차트·실시간 갱신) L로 넘어가므로 web는 얇은 읽기전용 패널로 제한하거나 후속 분리 권장.
**의존성**: 실측 트래픽: '80%+ 상시 점유' 트리거 판정은 실사용량이 있어야 의미 — 계측 자체는 지금 구현 가능하나 게이트 판정 가치는 트래픽에 의존; KAKAO_REST_API_KEY 미입력 시 kakao 외부호출·쿼터 카운트는 0 유지(STATUS상 키 대기 중); Kakao 일일 쿼터 수치 확인 필요: ADR-0007은 네이버 25k만 명시, 카카오 한도는 미문서화 → env 기본값 신뢰 전 확인; auto-cap(예산 소진 자동 차단) 후보의 선행 — 이 계측이 그 입력 데이터를 제공
**리스크**: in-memory 카운터는 프로세스 재시작·서버리스 콜드스타트마다 0으로 리셋 → '일일' 쿼터 집계가 비영속 호스트에서 부정확. 완화: 일자(date) 버킷 키 + 단일 상주 프로세스 가정, 영속화(Supabase)는 후속/ADR로 명시.; 수평 확장(다중 인스턴스) 시 인스턴스별 분산 카운트로 쿼터 과소집계 — M2 단일 무료 인스턴스 전제에선 허용, ADR에 한계 기록.; Anthropic 단가 상수는 지식 컷오프 드리프트 위험 — claude-api 스킬로 Sonnet 4.6 단가 확인 후 고정(또는 env 주입)하고 estCost는 '추정'으로 라벨.; safeFetch 계측이 SSRF 검증 순서·기존 150+ 테스트를 깨지 않아야 함: 호스트 검증 통과 후에만(또는 시도/성공 구분) 카운트.; 메트릭 공개 노출은 사용량 패턴 누출 → 인증 부재(ADR-0002)이므로 METRICS_TOKEN 임시 게이트 필수, 토큰은 .env만(시크릿 룰).; PIPA: 검색주체(공인 가능)·쿼리 텍스트를 메트릭에 저장하면 검색로그화 위험 → 집계 카운트만 저장(쿼리 미보존)으로 회피.
**비용**: $0 — 순수 in-memory 계측, 신규 런타임 의존성·외부 API 호출 없음. 오히려 예산 보호 효과: 라이브로 소진 중인 Anthropic 예산 $8.8(ADR-0008)을 estCostUsd/ratio로 가시화해 초과 전 경보 → 향후 auto-cap의 트리거 입력. 무료·무카드 원칙(ADR-0005) 및 키게이트·캐시·폴백 패턴과 정합.

### 10. Lighthouse CI 성능 예산(모바일) — 비차단 경고 게이트
`id: lighthouse-ci-perf-budget` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: QA-STRATEGY 및 ROADMAP이 요구하나 미구현. 무료·무카드·무LLM으로 성능/번들 회귀 조기 감시.

**수용 기준**:
- 빌드된 정적 산출물(apps/web/dist)을 대상으로 Lighthouse CI가 모바일 프로파일(throttling=mobile, 4x CPU slowdown·slow-4G — LHCI 기본 모바일 프리셋)로 numberOfRuns>=3 중앙값을 측정하고 리포트를 생성한다(treosh/lighthouse-ci-action 또는 @lhci/cli autorun).
- 랜딩(idle) 화면에 대해 first-contentful-paint·largest-contentful-paint 가 3000ms 초과 시 'warn' 단언이 설정된다(LHCI assert, level=warn) — error가 아니라 warn이라 PR을 막지 않는다.
- 번들 예산이 두 층으로 감시된다: (a) 초기 로드 스크립트 전송량 budget(현재 gzip~65KB 기준 헤더룸 둔 임계, 예 80KB)을 Lighthouse budgets.json/resource-summary로, (b) lazy 3D 청크(현재 raw 854KB/gzip 229KB)는 페이지 네비게이션에 로드되지 않아 LHCI가 못 보므로 의존성 0짜리 스크립트(apps/web/scripts/check-bundle-size.mjs)가 dist/assets/*.js 크기를 예산 JSON과 비교해 초과 시 경고를 출력한다.
- 성능 잡은 비차단이다: 별도 워크플로(.github/workflows/lighthouse.yml) 또는 continue-on-error 잡으로 분리되어 기존 blocking 'quality' 잡 속도에 영향이 없고, required status check에 포함되지 않는다.
- 시크릿/API 키 없이 동작한다 — 정적 dist(검색 미수행=개인정보 노드 없음)만 감사하므로 PIPA 노출 0이고 temporary-public-storage(무료, 카드 불요) 업로드 리포트에도 개인정보가 없다.
- 임계값은 현재 실측치+헤더룸으로 설정해 변경 없는 코드에서 거짓양성(flaky 경고)이 발생하지 않음을 연속 2회 실행으로 확인한다.
- ADR(docs/adr/0009-*.md)에 '비차단 경고·베이스라인 후 차단 승격·정적dist 감사·무카드 스토리지' 결정과 트레이드오프가 기록되고, QA-STRATEGY §8/§12 표와 docs/STATUS.md가 갱신된다.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/.github/workflows/lighthouse.yml (신규 — 비차단 성능 워크플로; build web → lhci)`, `/Users/kang/Desktop/cerebro/apps/web/lighthouserc.cjs (신규 — collect.staticDistDir './dist', 모바일 프리셋, numberOfRuns 3, assert warn 단언, upload temporary-public-storage)`, `/Users/kang/Desktop/cerebro/apps/web/budgets.json (신규 — Lighthouse 리소스 사이즈 예산, 초기 로드 스크립트/총량)`, `/Users/kang/Desktop/cerebro/apps/web/scripts/check-bundle-size.mjs (신규 — 의존성 0, dist 청크별 바이트 예산 가드; lazy 3D 청크 회귀 감시)`, `/Users/kang/Desktop/cerebro/apps/web/bundle-budget.json (신규 — 청크별 임계: MindMapCanvas≈260KB gzip, index≈80KB gzip)`, `/Users/kang/Desktop/cerebro/apps/web/package.json (수정 — 'lhci'/'size:check' script 추가, 선택적 @lhci/cli devDep)`, `/Users/kang/Desktop/cerebro/.github/workflows/ci.yml (참조 — blocking 잡은 그대로 유지, LH는 분리)`, `/Users/kang/Desktop/cerebro/apps/web/vite.config.ts (참조 — reportCompressedSize 확인용, 변경 불필요 가능)`, `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx (참조 — MindMapCanvas가 React.lazy로 이미 코드분할되어 초기 페이지엔 미로드; 예산 설계 근거)`, `/Users/kang/Desktop/cerebro/docs/adr/0009-lighthouse-perf-budget.md (신규 ADR)`, `/Users/kang/Desktop/cerebro/docs/QA-STRATEGY.md (수정 — §8 L222·§12 L296 Lighthouse CI 구현 표시)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md (수정 — 핸드오프 갱신)`
**노력 근거**: 설정 자체(lighthouserc + budgets)는 작지만, LHCI는 페이지 네비게이션에 로드되는 자원만 보므로 lazy 3D 청크(가장 무거운 854KB) 회귀를 잡으려면 별도 의존성0 스크립트+예산 JSON이 추가로 필요하고, CI에서 Chrome 가용성/스로틀 변동성 때문에 임계값을 거짓양성 없이 튜닝하는 데 보통 1~2회 푸시 사이클이 든다. 워크플로 분리·ADR·QA/STATUS 문서 갱신까지 합치면 S(<0.5d)를 넘는다. LHCI 메트릭만 최소 구성하면 S로 축소 가능하나, 소스가 명시한 '번들 사이즈 예산'을 충족하려면 청크 가드가 필수라 M(0.5~1.5d)으로 본다.
**의존성**: 외부 선결조건: GitHub Actions 무료 실행(공개 저장소이면 무료 — ci.yml gitleaks 주석이 '공개 저장소는 무료' 전제) 또는 Actions 분기 잔여. 카드/유료 불요.; CI Chrome: treosh/lighthouse-ci-action 사용 시 액션이 Chrome 설치를 처리(로컬 검증 시에는 Chrome 필요 — 현재 로컬에 chrome 미설치 확인됨).; 차단 게이트로 '승격'하려면 먼저 안정 베이스라인 확보 필요(트리거). 초기 도입 자체는 선결 후보 없음(ready).
**리스크**: CI 스로틀(LHCI 모바일 4x CPU·slow-4G) 변동성으로 임계 경고가 flaky해질 수 있음 → level=warn + numberOfRuns 중앙값 + 헤더룸 임계로 완화(QA §7.1·§11.7과 정합).; 정적 dist(idle 화면)만 감사하면 실제 그래프 렌더의 LCP는 측정되지 않음(API/검색 미수행). 트레이드오프: 결정적·무시크릿 vs 대표성↓ — M1 회귀 가드로는 충분하고 실그래프 FPS/성능은 수동(§7.1)으로 보완. ADR에 명시.; temporary-public-storage는 리포트를 공개 URL로 올림 → 반드시 개인정보 없는 랜딩 화면만 감사하도록 staticDistDir 고정(PIPA).; treosh action 고정 핀(@vNN) 미설정 시 공급망 리스크 → 버전 핀 필수. @lhci/cli devDep 채택 시 설치시간↑ 트레이드오프.; blocking 'quality' 잡에 LH를 섞으면 머지 속도 저하 → 반드시 별도 비차단 잡으로 분리(QA §8 '메인 파이프라인은 빠르고 결정적').
**비용**: $0 추가 비용. GitHub Actions 무료 티어(공개 저장소)·LHCI temporary-public-storage 무료·카드 불요로 ADR-0005(무료·무카드) 준수. LLM 미사용이라 Anthropic 예산 $8.8에 영향 없음. PR당 web 빌드+LH 실행으로 CI 분 ~1~2분 추가되나 별도 잡 + 기존 concurrency cancel-in-progress(ci.yml)로 흡수.

---

## LATER · 가치 있으나 후순위

_가치는 있으나 M2/M3 지향이거나, NOW/NEXT 항목과 기능이 겹쳐 통합 대상이거나, YAGNI·실행환경 제약으로 후순위. 대부분 readiness=ready지만 핵심 루프/출시 게이트와의 거리가 멀다._

### 1. 그래프 UX 개선: 카테고리 필터 · 검색 히스토리 · 공유 링크 (무상태/무료 서브셋)
`id: graph-ux-filters-history-share-m2` · 노력 **L(큼)** · 🟢 착수 가능 · tier:next

**왜**: ROADMAP §4 M2 핵심산출물 ③. M1 라이브 후 재방문/저장 기반의 최소 진입점이며 비용 0·키 0·계약 무변경으로 즉시 착수 가능. 무상태(쿼리 인코딩)+로컬(localStorage) 서브셋을 먼저 내 가치를 검증하고, 영속 저장은 Auth 후보로 분리.

**수용 기준**:
- 필터: 범례/필터 패널의 카테고리 토글을 끄면 해당 kind 노드가 3D 그래프에서 사라지고, center 노드는 항상 표시되며, 숨겨진 노드를 양끝으로 갖는 edge도 함께 숨겨진다. 순수 함수(filterGraph(graph, hiddenKinds))의 단위 테스트가 노드/엣지 결과를 검증한다.
- 필터 a11y: 토글은 실제 button + aria-pressed로 키보드 조작 가능하고, 모바일(@media max-width:640px) 레이아웃을 깨지 않는다.
- 히스토리: 검색 제출 시 쿼리가 버전드 키의 localStorage에 저장된다(중복 제거, 최신순, 상한 N=8). 최근 검색이 선택 가능한 칩으로 렌더되고 클릭하면 그 검색이 실행된다. history 라이브러리(add/dedupe/cap/load/clear) 단위 테스트가 jsdom에서 통과한다.
- 히스토리 지우기: '지우기' 컨트롤이 저장 데이터와 UI를 모두 비운다(사용자 데이터 통제·최소화).
- 공유 링크: 검색 후 URL이 ?q=<encodeURIComponent(query)>로 갱신된다(history.replaceState, 새로고침 없음). ?q=가 있는 URL로 진입하면 마운트 시 1회 자동 검색이 실행된다(App 테스트: location ?q=토스 → searchCerebro가 '토스'로 정확히 1회 호출). '공유' 버튼이 현재 URL을 클립보드에 복사하고 확인 피드백을 보여주며, 클립보드 실패/비보안 컨텍스트에서 폴백 처리된다.
- 의존성 무증가: apps/web/package.json에 신규 런타임 의존성이 추가되지 않는다(native URLSearchParams + localStorage + Clipboard API만 사용, react-router 미도입).
- 비용/PIPA: URL과 서버에 그래프/개인정보가 영속화되지 않고 쿼리 문자열만 공유된다. 공유 진입은 기존 POST /api/search 재호출(30분 캐시 히트 시 Anthropic 지출 0)이며 신규 API/DB 없음.
- 게이트: pnpm typecheck && test && lint && build 그린, 신규 any/console.log 없음. 무상태 공유 vs 영속 스냅샷 결정과 native-URL vs react-router 결정을 docs/adr/에 5~15줄 ADR로 기록.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/SearchBar.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/CategoryLegend.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/MindMapCanvas.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/GraphFilters.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/ShareButton.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/history.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/history.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/graph-filter.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/graph-filter.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/url.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/App.test.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/index.css`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts`, `/Users/kang/Desktop/cerebro/docs/adr/`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 세 서브기능(필터 M, 히스토리 S, 공유 S)의 합 + 테스트·CSS·a11y·통합/시각검증으로 M/L 경계 상단. 모두 신규 파일이지만 클라이언트 한정이고 schema 변경이 없어 위험은 낮다. git-workflow(원자적 브랜치/커밋) 원칙대로 3개 PR로 분할 권장: ① feat/web-graph-filters(graph-filter.ts + GraphFilters/CategoryLegend 인터랙티브 + MindMapCanvas 소비) ② feat/web-search-history(history.ts + SearchBar 칩) ③ feat/web-share-link(url.ts + ?q= 마운트 + ShareButton + ADR). 각 PR은 S~M.
**의존성**: (소프트) 영속 저장/계정 동기화 기반 '저장된 그래프 공유'와 기기간 히스토리 동기화는 M2 ④ '가벼운 계정(Supabase Auth)' 후보에 의존 — 본 후보는 무상태(쿼리)·로컬(localStorage) 서브셋으로 범위를 한정해 의존성 없음; 외부 키/승인/트래픽 선결조건 없음(전부 클라이언트, 기존 POST /api/search 재사용)
**리스크**: 재현성: ?q= 공유 재실행 그래프는 원작성자가 본 것과 다를 수 있음(신선 소스, LLM 비결정성, 30분 캐시 만료). M2 쿼리-공유 수준에선 수용; 스냅샷 충실도가 필요하면 영속 저장(Auth 후보)으로 이관. ADR에 명시.; 엣지 정합: 노드 숨김 시 고아 엣지/잔재 — filterGraph에서 양끝 가시성 검사로 엣지 동시 제거, layoutGraph는 필터된 그래프로 useMemo 재계산(현 MindMapCanvas 패턴 유지).; localStorage 부재/차단(프라이빗 모드): try/catch 가드로 우아하게 비활성(히스토리 미표시), 검색 자체는 무영향.; Clipboard API는 보안 컨텍스트(https/localhost) 필요: 실패 시 입력 선택/수동 복사 폴백 + 에러 삼키지 않기.; 한글 쿼리 URL: encodeURIComponent/decode + GRAPH_LIMITS.MAX_QUERY_LENGTH(80) 재검증으로 깨짐·오버플로 방지.; PIPA: 히스토리·공유 URL에 인물명 포함 가능 — 로컬 저장만/서버 미전송, '지우기' 제공, 공유 파라미터의 서버 로깅 추가 금지. '공인·공개정보 한정' 정책이 1차 방어.; 스코프 크리프: 계정/영속 저장된 마인드맵 공유는 본 후보에서 제외(별도 후보).
**비용**: 순증 비용 $0. 전부 클라이언트(URLSearchParams/localStorage/Clipboard), 신규 의존성·API·DB·키 없음. 공유 진입은 기존 POST /api/search 재호출 → 30분 서버 캐시(createTTLCache) 히트 시 Anthropic 지출 0(cached=true), 캐시 미스는 일반 검색과 동일 비용으로 이미 ADR-0008 예산($8.8, 키 게이트·휴리스틱 폴백) 내 처리. ADR-0005(무료·무카드) 정합.

### 2. 활용 리포트 캐시·품질 관측(메트릭 카운터 + /metrics 스냅샷)
`id: usage-report-cache-quality-monitoring` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 가치/동기: 비용·품질의 핵심 방어선(캐시·폴백)을 측정 불가한 현 상태를 해소. 무비용·즉시착수 가능하며 자동 상한 후보의 기반이 됨.

**수용 기준**:
- 신규 모듈 apps/api/src/lib/metrics.ts: 인메모리 카운터 레지스트리(순수 함수, 부수효과 격리). record*()와 snapshot()를 노출하고 snapshot()은 집계 수치만 반환(원문 쿼리·URL·개인정보 절대 미포함). 단위 테스트(metrics.test.ts)가 각 outcome 증가 시 카운터가 정확히 오르는지 검증.
- server.ts의 POST /api/search가 요청당 정확히 1건의 outcome을 분류·기록: {cached, analyzed(analysis.angles.length>0), heuristic-fallback(analysis null이거나 angles 빈 경우), mock-fallback(nodes.length<=1 또는 collect throw), error(analyzeUsage 예외)}. server.test.ts에서 app.inject로 검증: 동일 쿼리 2회째는 cacheHits 증가, example 어댑터+키없음 경로는 heuristic-fallback 버킷 증가.
- 관점 분포 기록: UsageAngleKey(report.ts USAGE_ANGLES 9종)별 출현 카운트 + 리포트당 관점 수 합계(평균 도출 가능). metrics.test.ts가 analyzed 결과 기록 시 해당 key 카운트가 오르는지 직접 검증.
- cacheHitRate = hits/(hits+misses)를 snapshot이 노출. 히트 1회+미스 1회 후 값이 정확한지 테스트로 검증(분모 0이면 0 또는 null로 안전 처리).
- GET /metrics가 packages/shared의 신규 MetricsSnapshotSchema(zod)로 검증된 JSON을 반환. server.ts가 응답을 해당 스키마로 parse(기존 /api/search의 SearchResponseSchema.parse SSOT 패턴과 동일). 테스트: 200 + 스키마 parse 성공 + 선행 검색들이 수치에 반영.
- PIPA 가드: snapshot/응답에 원문 검색어가 들어가지 않음을 테스트가 단언(예: 검색 후 JSON 직렬화 문자열에 쿼리 토큰 부재). 공인·공개정보 한정 정책과 정합.
- 전체 게이트 그린: pnpm typecheck && pnpm test && pnpm lint && pnpm build (현재 150+ 테스트 그린 상태 유지).

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/lib/metrics.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/metrics.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/search.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/index.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`, `/Users/kang/Desktop/cerebro/docs/adr/0009-usage-report-observability.md`
**노력 근거**: 코어 변경은 작다: metrics.ts 카운터 모듈(~40-60줄, lib/cache.ts와 동급 규모), server.ts 배선(요청당 1줄 record + /metrics 라우트 1개), 2개 테스트 파일. 다만 S(<0.5d)를 넘기는 요인: (1) 프로젝트 규약상 API 응답은 zod 계약 SSOT라 packages/shared에 MetricsSnapshotSchema 추가+export 필요, (2) outcome 5종 분류를 server.ts try/catch 흐름(현 server.ts:56-71)에 정확히 끼워넣는 작업, (3) /metrics 노출 게이팅 결정(M2 인증 보류, ADR-0002)과 짧은 ADR 기록. 합쳐 0.5~1.0d로 light-M.
**의존성**: 없음(외부 키·승인·트래픽 불요 — 인메모리 카운터, 추가 외부 호출 0이라 즉시 착수 가능); 소프트 관계(비차단): 자매 후보 'LLM 사용량·비용 메트릭 + 자동 상한'(STATUS.md:81)과 metrics.ts 모듈을 공유. 이 작업을 먼저 하면 그 자동 상한 후보가 동일 카운터(LLM 호출수·폴백률)를 재사용할 기반이 됨 → 선행 권장이나 의존성은 아님
**리스크**: 오버엔지니어링 함정: Prometheus/Grafana/외부 APM은 무료·MVP 범위를 벗어난다(YAGNI). 인메모리 카운터 + JSON 스냅샷 1개로 제한할 것. .claude/rules/coding-standards.md의 '조기 추상화 금지'와 정합.; 휘발성: 인메모리 카운터는 프로세스 재시작 시 0으로 리셋(cache.ts와 동일 한계). 따라서 '회귀 감지'는 시점 스냅샷 수준이며 추세·알림(과거 대비 베이스라인)은 Supabase 영속화가 필요 → 이번 범위 밖. AC에 '시점 스냅샷'으로 기대치 한정.; PIPA: 카운터에 원문 검색어(인물명 등)가 섞이면 공개정보·공인 한정 정책 위반. 집계 수치만 저장하도록 강제하고 테스트로 단언(AC #6).; 노출 면적: 인증 보류(ADR-0002) 상태라 /metrics가 무인증 공개되면 운영 지표가 노출됨. 완화안 결정 필요 — env 플래그(METRICS_ENABLED, 기본 dev=on) 또는 localhost 한정. 집계 전용이라 민감도는 낮으나 결정은 짧은 ADR로 기록.; 분류 정밀도: 서버 레벨에서 폴백 사유(키없음 vs refusal vs 빈응답)를 세분하려면 report.ts analyzeUsage의 반환형을 바꿔야 함(현재 null로 뭉뚱그림, report.ts:127/149/155). 이번엔 server가 관측 가능한 5버킷으로 거칠게 분류하고, 세분화는 후속으로 둘 것(스코프 폭주 방지).
**비용**: API/예산 영향 0 — 신규 외부 호출 없음(순수 인메모리 카운터 + 로컬 JSON 엔드포인트). 오히려 $8.8 Anthropic 예산을 '보호'한다: 캐시 적중률(절감 확인)·LLM 호출 발생률·폴백/실패율을 가시화해 비용 급증과 품질 회귀를 조기 포착. 자매 후보(자동 상한)가 소비할 메트릭 기반을 무비용으로 마련. ADR-0008의 키 게이트·캐시·폴백 비용통제 패턴을 그대로 유지(변경 없음).

### 3. LLM 사용량·비용 메트릭 계측 (토큰/비용 누적 기록·노출)
`id: llm-usage-cost-metrics` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 현재 Claude 호출 비용은 `analyze/report.ts`가 `res.usage`를 버리기 때문에 전혀 관측되지 않는다(grep 결과 usage/cost/metric 코드 0건). $8.8 예산에서 지출 차단의 유일한 수단이 ".env에서 키를 빼기"인 수동 방식이며(ADR-0008 마지막 줄, STATUS §5.9), 누적 지출이 보이지 않으면 언제 한도에 닿는지 알 수 없다. 토큰/비용/호출수를 누적 기록·노출하면 (1) 예산 가시화, (2) 자동 상한(예산 소진 시 차단)의 선행 인프라, (3) 캐시 효율(cache_read 토큰) 모니터링의 데이터 소스가 동시에 확보된다. 호출 1곳(report.ts)만 계측하면 되는 저위험 작업이다.

**수용 기준**:
- 비용 계산 단위테스트: 모델 `claude-sonnet-4-6` + 입력 3000·출력 2500 토큰 입력 시 추정 비용 = 3000/1e6*$3 + 2500/1e6*$15 = $0.0465 (반올림 오차 내)로 검증된다(ADR-0008 추정 $0.03~0.05와 일치).
- 가격표는 모델 id 키로 단일 모듈에 있고, 미등록 모델은 throw 없이 토큰만 기록하고 비용은 0 + `priced:false` 플래그로 표시한다(단위테스트).
- `analyzeUsage`가 성공 호출 시 응답 `res.usage`(input_tokens/output_tokens/cache_creation_input_tokens/cache_read_input_tokens)를 누적기에 기록한다 — report.test.ts의 mock 클라이언트에 `usage`를 추가하고, 주입된 recorder가 토큰값을 받았는지 assert한다.
- 키 미설정/항목 0건/refusal로 호출이 일어나지 않은 경우 메트릭이 증가하지 않는다(지출 0 불변식 유지, 기존 report.test.ts 케이스와 정합).
- `GET /api/metrics`가 누적 카운터 `{calls, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, estimatedCostUsd, byModel, since}`를 반환하고 `packages/shared`의 `MetricsResponseSchema`(zod)로 검증을 통과한다(server.test.ts).
- 메트릭 응답에 쿼리 원문·개인정보가 포함되지 않는다(모델 id·토큰수·비용 등 집계값만) — PIPA 정합.
- 캐시 히트 검색은 LLM 호출이 없으므로 `calls`/토큰이 증가하지 않음을 확인한다(server.ts가 캐시 히트 시 analyze 이전에 return).
- pnpm typecheck && pnpm test && pnpm lint && pnpm build 그린(기존 게이트 유지).

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/analyze/report.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/metrics/llm-usage.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/metrics/llm-usage.test.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/metrics.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/index.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.test.ts`
**노력 근거**: 단일 호출 지점(report.ts L141-147)만 계측하면 되지만, 클린한 테스트 가능 설계를 위해 (1) shared 계약(MetricsResponseSchema) 우선 추가, (2) api 가격표+인메모리 누적 모듈+단위테스트, (3) report.ts에 recorder 주입(기존 deps 패턴 활용, 시그니처 `UsageReport|null` 유지로 blast radius 최소화), (4) server.ts 신규 라우트+테스트로 4개 레이어에 걸친다. S(<0.5d)로 보기엔 shared 계약+엔드포인트+다층 테스트가 있고, L(>1.5d)로 보기엔 로직이 단순(순수 산술+카운터)하다 → M.
**의존성**: 없음
**리스크**: 하드코딩 가격표는 모델 단가 변동 시 드리프트 — 단일 모듈·모델키 격리 + 미등록 모델 graceful 처리로 완화, 값 출처를 ADR-0008/주석에 명시.; 인메모리 누적은 프로세스 재시작/다중 인스턴스에서 초기화·분산 미집계 — 단일 인스턴스 MVP에선 허용(cache.ts와 동일 정책). 단, 자동 상한을 신뢰하려면 영속 저장(Supabase)이 선행 필요 → 본 작업은 카운터 인터페이스를 영속화 교체 가능하게 설계.; `GET /api/metrics`가 무인증이면 지출 정보 노출 — 개인정보는 아니나, 추후 게이팅 고려(노출은 집계값만으로 한정해 위험 축소).; usage 기록이 예외를 던지면 검색이 깨질 수 있음 — 순수 함수/방어적 try 또는 server.ts try/catch 내부에서 호출해 검색 연속성 보장.; report.ts가 현재 res.usage를 읽지 않으므로 기존 mock 클라이언트가 usage 필드 없음 — 테스트 fixture 업데이트 필요(누락 시 NaN 유입 방지 가드 추가).
**비용**: 추가 API 비용 0 — 순수 계측이며 테스트는 mock 클라이언트로 네트워크 호출 없음(기존 report.test.ts 패턴). 오히려 $8.8 예산의 가시화·거버넌스를 가능케 해 자동 상한(예산 소진 차단)의 선행 인프라가 된다. 캐시 히트는 LLM 호출 자체가 없어 메트릭에도 비용 0으로 반영(server.ts 캐시 단락).

### 4. 분석·관측성 도입 (이벤트·퍼널·에러 트래킹) — 1차 계측 레이어
`id: analytics-observability-m2` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: M2 Exit Criteria(ROADMAP §4)는 "핵심 루프 완주율·재방문(리텐션)·크래시 안정선"을 정량 목표로 요구하는데, 현재 코드베이스에는 계측이 0건이다(grep posthog/sentry/plausible/analytics → docs 언급만, 코드 0). 즉 M2 리텐션 검증은 측정 인프라가 없어 시작조차 불가하며, 이 작업이 그 선행 전제다. GTM §6은 측정해야 할 AARRR 퍼널을 이미 확정해 뒀다: search_submitted→search_succeeded(중심+가지≥3 렌더 성공율 ≥95%)→node_clicked(≥60%)→즉시이탈(0클릭 ≤25%)→주간 재방문(M2 측정). 이 이벤트들이 발생하는 지점이 모두 apps/web/src/App.tsx의 status 상태기계(idle→loading→ready→error)와 setSelected에 모여 있어 계측 삽입 비용이 낮다. 무카드·PIPA·무료 원칙과 충돌 없이 "퍼스트파티 이벤트 파이프라인"(기존 Fastify+pino 로거 재사용)으로 지금 만들 수 있고, 첫 공개 배포 전에 들어가야 day-1 트래픽이 측정된다.

**수용 기준**:
- packages/shared에 `AnalyticsEventSchema`(zod, .strict())와 이벤트명 상수(app_loaded·search_submitted·search_succeeded·search_failed·node_clicked·client_error)를 SSOT로 추가하고, 유효 이벤트 parse 통과 / PII·미정의 필드 포함 시 reject를 단위테스트로 검증(계약 먼저 원칙).
- 프론트가 GTM §6 퍼널 지점에 정확히 이벤트를 emit한다: App.tsx mount→app_loaded, handleSearch 시작→search_submitted, status='ready'→search_succeeded({nodeCount, edgeCount, cached}), 'error'→search_failed({reason}), setSelected→node_clicked({nodeKind}). RTL+vitest로 검색/노드선택 시 emitter가 올바른 이벤트로 호출됨을 단언.
- 클라이언트 생성 익명 세션 ID(crypto.randomUUID, sessionStorage/localStorage 영속)가 모든 이벤트에 부착되되, 이름·이메일·IP·원시 검색어 등 PII 필드는 스키마에서 거부(PIPA: ADR-0002 익명 전제). 검색어는 길이/해시 등 비식별 형태로만, 원문은 외부 싱크로 보내지 않음.
- 백엔드 `POST /api/events`가 shared 스키마로 검증(유효→202/204, 무효→400 ApiError 스키마)하고 클라이언트 IP/PII 미저장 상태로 pino 구조화 로그에 기록. app.inject 테스트로 202·400 양쪽 단언(server.test.ts 패턴 재사용).
- 에러 트래킹: web의 window 'error'/'unhandledrejection'와 api 검색 실패 경로(server.ts try/catch)가 스택·PII 없는 안전 필드로 client_error/error 이벤트를 남긴다. 핸들러가 emit하는지 테스트.
- 무료·무카드 게이트: 유료 SDK/벤더 추가 0. 분석은 `VITE_ANALYTICS_ENABLED` 등 플래그로 기본 비활성(no-op)이라 테스트·로컬에서 부수효과 0(키게이트/폴백 패턴 일관). gitleaks·CI(lint·typecheck·test·build) 그린.
- ADR-0009에 접근(퍼스트파티 이벤트 파이프라인 vs 서드파티 SDK) 트레이드오프 기록, docs/STATUS.md·docs/GTM.md §6 측정 인프라 항목 갱신.

**건드릴 파일(예상)**: `packages/shared/src/schemas/analytics.ts (신규: AnalyticsEventSchema)`, `packages/shared/src/schemas/analytics.test.ts (신규)`, `packages/shared/src/index.ts (re-export 추가)`, `packages/shared/src/constants.ts (ANALYTICS_EVENTS 상수 추가)`, `apps/web/src/lib/analytics.ts (신규: 익명 세션ID + fetch/beacon emitter)`, `apps/web/src/lib/analytics.test.ts (신규)`, `apps/web/src/App.tsx (퍼널 지점 5개 계측 — 17~73행)`, `apps/web/src/main.tsx (전역 error/unhandledrejection 핸들러 초기화)`, `apps/web/src/api/client.ts (검색 실패 시 client_error emit — 15~22행)`, `apps/web/src/vite-env.d.ts (VITE_ANALYTICS_ENABLED 타입)`, `apps/api/src/server.ts (POST /api/events 라우트 등록 — 33~76행 인근)`, `apps/api/src/events/handler.ts (신규) + apps/api/src/events/handler.test.ts (신규)`, `apps/api/src/env.ts (분석 싱크/플래그 옵션 — optionalSecret 패턴)`, `apps/api/src/server.test.ts (events 라우트 테스트 추가)`, `.env.example (VITE_ANALYTICS_ENABLED 빈 플레이스홀더)`, `docs/adr/0009-analytics-observability.md (신규) + docs/STATUS.md + docs/GTM.md`
**노력 근거**: 자족적 계측 레이어로 범위를 좁히면 M(0.5~1.5d): shared zod 계약(S) + 경량 퍼스트파티 emitter·세션ID(S) + App.tsx 5지점 배선(S) + Fastify POST /api/events 검증·로그(S) + 에러 핸들러(S) + 양측 vitest. 기존 패턴 재사용 비용이 낮다(zod 경계 검증·pino 로거·fetch client·app.inject 테스트·optionalSecret 키게이트가 이미 존재). 외부 대시보드/Supabase 테이블 영속/리텐션 코호트 집계는 의도적으로 Phase B로 분리(trigger 참고)했기에 L로 번지지 않는다 — 그 둘까지 포함하면 L.
**의존성**: M1 공개 배포(현재 vercel/fly/render 등 호스팅 설정 0건 — 리포지토리에 deploy config 없음): 퍼널·리텐션의 '실제 수치'는 실유저 트래픽이 있어야 의미. 계측 코드 자체는 무의존으로 지금 구현·단위검증 가능하나, 분석 결과(완주율/재방문)는 배포+트래픽이 선결.; ADR-0002(인증 M2 연기→익명): 분석은 계정 없는 익명 세션ID 기반이어야 함(반영 완료 전제).; Phase B 대시보드 채택 시 무료·무카드 벤더(PostHog/Umami/Sentry 무료티어) 또는 이미 스택에 있으나 미배선인 Supabase(env.example만 존재, 코드 미사용) 클라이언트 배선·RLS.
**리스크**: 배포·트래픽 없이는 계측이 액션가능한 리텐션 데이터를 못 만든다(가치 지연). 완화: 첫 공개 배포 직전/동시에 머지해 day-1부터 측정.; 서드파티 SDK는 IP·핑거프린팅 수집으로 PIPA 노출 위험. 완화: 퍼스트파티 이벤트 파이프라인 우선, 벤더 채택 시 IP수집 비활성·EU리전·ADR 기록.; 성능 예산 위협(M1 의미콘텐츠 <3s, web은 R3F로 무거움). 완화: 무거운 SDK 대신 ~수KB fetch/sendBeacon emitter.; 이벤트 스키마 조기 과설계(YAGNI). 완화: AARRR Acq→Act 이벤트만 고정, 리텐션은 세션ID+timestamp에서 파생(신규 이벤트 불필요). share 이벤트는 공유링크 기능(M2 백로그, 현재 web에 share 코드 0) 착수 시 추가 — 스키마는 확장 가능하게.; Supabase 영속을 이번 범위에 넣으면 클라이언트 배선·RLS로 스코프 폭주 → Phase B로 분리 유지.
**비용**: $0. 퍼스트파티 파이프라인은 기존 Fastify+pino 로그(및 이미 스택에 있는 Supabase 무료티어, 선택)만 사용 — 카드·신규 유료 의존성 0. Anthropic $8.8 예산과 완전 분리(분석 경로는 LLM 호출 없음 → analyze/report.ts 비용 영향 0). Phase B로 무료티어 벤더(PostHog/Umami/Sentry, 무카드) 채택해도 무료 한도 내 $0.

### 5. 대형 그래프 LOD/인스턴싱 성능 예산
`id: graph-performance-lod-budget` · 노력 **L(큼)** · 🟢 착수 가능 · tier:next

**왜**: ROADMAP M1 Exit Criteria ②("중급 모바일 의미 콘텐츠 <3s, 인터랙션 60fps 지향, 대형 그래프 LOD 동작")와 핵심 산출물 ②("LOD/인스턴싱 기초")를 정식 충족시키는 M1 클로즈아웃 항목. 현 렌더러(apps/web/src/components/MindMapCanvas.tsx)는 노드마다 개별 `<mesh>` + `sphereGeometry(radius,32,32)`(노드당 ~2k 삼각형) + 개별 `meshStandardMaterial`, 엣지마다 drei `<Line>` 1개로 그린다. 인스턴싱·LOD·적응형 dpr·모바일 폴백이 전혀 없다. 또 성능 계측 도구(Lighthouse CI/번들 예산/r3f-perf)와 layout 단위테스트가 부재해 "예산을 지킨다"는 주장을 검증할 수단이 없다. 이 작업은 인스턴싱+LOD 렌더 경로와 검증 가능한 성능 예산 하네스를 도입해 그 공백을 메운다.

**수용 기준**:
- 노드를 InstancedMesh 기반으로 렌더(단일/소수 인스턴스드 메시 + 인스턴스별 색)하여, draw 원시객체가 노드 수만큼의 개별 Mesh가 아님을 `@react-three/test-renderer` 씬그래프 단언 테스트로 검증(QA-STRATEGY §7 '씬그래프 단언', 인스턴싱 카운트 == graph.nodes 수)
- 노드 클릭/호버 선택이 InstancedMesh의 `e.instanceId` 기반 레이캐스팅으로 유지되어, 시뮬레이트한 클릭이 올바른 node.id로 onSelect를 호출함을 테스트로 검증(DetailPanel 선택 회귀 없음)
- LOD: 구체 세그먼트 수(및/또는 라벨·디테일)를 노드 레벨(center/branch/leaf)·importance·카메라 거리로 단계화하고, 그 결정적 tier 함수를 신규 파일 apps/web/src/lib/layout.test.ts에서 200노드 합성 픽스처로 단위테스트(tier 분포 + 총 삼각형 예산 임계 이하 단언) — GPU 불요, 하드 게이트
- GRAPH_LIMITS(200노드/400엣지) 한도의 합성 대형 그래프 픽스처가 test-renderer에서 에러 없이 렌더되고, packages/shared/src/schemas/graph.ts의 GraphSnapshotSchema에 nodes/edges `.max(GRAPH_LIMITS.*)` 계약 상한을 추가해 성능 예산을 계약으로 경계(shared 테스트 추가)
- 번들 예산: three/R3F를 별도 청크로 분리(vite manualChunks)하고 크기 회귀 단언 추가(size-limit 또는 Vite build size 체크) — 초기엔 경고, 베이스라인 후 회귀 임계만 실패(QA §7)
- Lighthouse CI 잡을 .github/workflows/ci.yml에 비차단(warn)으로 추가, 모바일 프로파일에서 FCP/LCP < 3s 대역 측정(빌드 preview 대상). FPS는 QA §7대로 CI 하드 게이트로 두지 않고 r3f-perf 수동 관측 결과를 ADR/STATUS에 기록
- 모바일/reduced-motion 폴백: 적응형 dpr + 저세그먼트 LOD + (선택)보조 광원 비활성을 coarse pointer/prefers-reduced-motion에서 선택하는 분기를 두고, 폴백 tier 선택을 단위테스트로 검증(ROADMAP M1 산출물 ⑥ '3D 품질 자동 저하')
- 인스턴싱·LOD·force-layout 보류·레이캐스팅 방식의 트레이드오프를 docs/adr/0009-*.md(5~15줄)로 기록, docs/STATUS.md·docs/QA-STRATEGY.md 갱신
- 전체 게이트 그린: pnpm typecheck && pnpm test && pnpm lint && pnpm build

**건드릴 파일(예상)**: `apps/web/src/components/MindMapCanvas.tsx`, `apps/web/src/lib/layout.ts`, `apps/web/src/lib/layout.test.ts`, `apps/web/src/lib/colors.ts`, `apps/web/vite.config.ts`, `apps/web/package.json`, `apps/web/src/test/setup.ts`, `packages/shared/src/schemas/graph.ts`, `packages/shared/src/constants.ts`, `.github/workflows/ci.yml`, `docs/adr/0009-graph-lod-instancing.md`, `docs/STATUS.md`, `docs/QA-STRATEGY.md`
**노력 근거**: 단일 렌더러 교체가 아니라 여러 하위작업의 묶음: (1) 개별 mesh→InstancedMesh 재작성 + 인스턴스별 색/매트릭스, (2) instanceId 레이캐스팅으로 클릭/호버 선택 의미 재구현(현재 hover시 scale 1.25 효과는 인스턴스 매트릭스로 재현 필요), (3) 레벨/거리 LOD tier 함수 + layout 메타, (4) 200노드 합성 픽스처와 신규 테스트 2종(layout.test + 씬그래프 test-renderer, 무료 dev dep 추가), (5) 번들 분리·크기 예산, (6) Lighthouse CI 비차단 잡, (7) 모바일/reduced-motion 폴백, (8) 계약 상한 + ADR/문서. 다수 서브시스템에 걸쳐 >1.5d.
**의존성**: 외부 키/승인 불필요 — 프론트엔드 전용; 소프트 선결: API 빌더(apps/api/src/graph/build.ts)는 현재 중심+≤10가지(MAX_BRANCHES=10)만 emit하고 leaf를 만들지 않아 실서비스 그래프는 ≤~11노드 — 대형 그래프는 합성 픽스처로 검증해야 함(차단요소 아님)
**리스크**: YAGNI/조기최적화 리스크: 현재 실서비스 그래프는 ≤~11노드라 60fps가 이미 자명하게 충족됨. 인스턴싱 실익은 아직 생산되지 않는 규모에서 발생 → 변경 범위를 작게 유지·합성 픽스처로 검증(단 M1 Exit ② 자체가 요구사항이라 정당화); InstancedMesh 레이캐스팅 전환이 클릭/호버 선택 의미를 바꿔(instanceId 기반) DetailPanel 선택 회귀 위험 — 씬그래프 테스트로 가드 필요; 현재 호버 시 개별 mesh scale 1.25 강조는 인스턴싱에서 per-instance 매트릭스 갱신 필요 → 강조 방식 변경 결정 필요; 엣지가 drei `<Line>` 1개/엣지(400엣지=400객체)라 노드만 인스턴싱하면 엣지가 병목 → LineSegments 단일 지오메트리 배칭곌지 하면 스코프 확대 위험(범위 명시 필요); Lighthouse CI는 GH Actions 환경편차로 노이즈가 큼 → QA §7대로 비차단(warn) 유지, 회귀 임계만 실패 처리
**비용**: Anthropic/외부 API 비용 0 — 순수 프론트엔드 렌더링/테스트 작업으로 $8.8 예산 무영향, 키 게이트·캐시·폴백 패턴 불변. 추가 도구는 모두 무료 OSS(@react-three/test-renderer, Lighthouse CI, size-limit, r3f-perf=dev전용)로 무카드 원칙(ADR-0005) 준수. Lighthouse CI는 GitHub Actions 무료 러너에서 실행. PIPA 무관(신규 데이터 수집/필드 없음).

### 6. 프론트 실데이터 브라우저 시각 검증 (수동 QA 체크리스트)
`id: frontend-live-data-visual-qa` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 데이터층은 이미 라이브로 검증됨(메모리 L25). 남은 공백은 브라우저 시각 회귀이며, QA-STRATEGY §6.3이 이를 수동 체크리스트로 점검하도록 지정했으나 실제 체크리스트/실행 기록이 없다. 비용 0·무카드·릴리스 하드닝 가치가 있어 다음 세션이 바로 착수 가능.

**수용 기준**:
- 상태×환경 매트릭스를 명시한 수동 시각 QA 체크리스트 문서가 구체 경로(예: docs/qa/visual-qa-checklist.md)에 존재한다. 행 = {idle, loading(CerebroLoader), ready, error, center-only/빈약-mock, 대형(center+MAX_BRANCHES=10+leaves), DetailPanel 열림, CategoryLegend+SourceSummary 오버레이} × 열 = {데스크톱, 모바일 ≤640px 뷰포트} × {기본 모션, prefers-reduced-motion} × {OS 다크, OS 라이트}. 각 행에 기대 결과와 pass/fail 칸이 있다.
- 라이브 로컬 스택(pnpm dev: web :5173 + api :8787)에 대해 체크리스트를 1회 실행하고 실행 환경(브라우저+OS 버전)과 사용 쿼리(예: '토스')를 기록한 결과(행별 pass/fail)가 남는다.
- reduced-motion 검증: DevTools Rendering 에뮬레이션 또는 OS 설정으로 prefers-reduced-motion:reduce일 때 CerebroLoader의 silhouette/core 애니메이션이 정지(index.css L454-463)하고, 정지 상태의 3D 캔버스에 연속 모션이 없음(OrbitControls autoRotate 미사용)을 확인·기록한다.
- OS 라이트 모드 검증: OS를 라이트로 전환해도 다크 UI가 깨지지 않음을 확인한다. 특히 네이티브 컨트롤(검색 input, 스크롤바, 포커스 링)을 점검하고, index.css에 color-scheme:dark 선언이 없어 라이트 OS에서 네이티브 UI가 이질적으로 렌더되는지 finding으로 기록한다(현재 미선언).
- 빈약/center-only 결과와 대형 그래프(center + 10 branches + leaves)가 둘 다 크래시·콘솔 에러 없이 렌더되고 가독성(심한 겹침 없음)이 유지됨을 관찰·기록한다.
- 발견된 S1/S2 시각 결함은 QA-STRATEGY §9 심각도 라벨로 GitHub 이슈 등록하거나 'S1/S2 없음'을 명시 기록한다. 픽셀 스냅샷 베이스라인은 도입하지 않는다(§6.3 수동 한정).
- 신규 유료 외부 의존성 0. QA 중 Anthropic 지출은 캐시/휴리스틱 폴백으로 예산 내 유지하고 대략 지출을 기록한다.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/MindMapCanvas.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/CerebroLoader.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/index.css`, `/Users/kang/Desktop/cerebro/apps/web/src/components/DetailPanel.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/CategoryLegend.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/SourceSummary.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/layout.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.ts`, `/Users/kang/Desktop/cerebro/docs/QA-STRATEGY.md`, `/Users/kang/Desktop/cerebro/docs/DESIGN-SYSTEM.md`, `/Users/kang/Desktop/cerebro/docs/qa/visual-qa-checklist.md (신규 산출물)`, `/Users/kang/Desktop/cerebro/apps/api/.env (키 존재 — 출력/커밋 금지)`
**노력 근거**: 체크리스트 문서 작성 자체는 작지만(S), 다상태 매트릭스를 라이브 스택으로 실제 점검(OS 라이트/다크 토글, reduced-motion 토글, 모바일 뷰포트, 빈/대형 그래프) + 환경별 결과 기록 + finding 이슈화, 그리고 발견 가능성 높은 소규모 수정(예: index.css에 color-scheme:dark 추가)까지 포함하면 반나절~1.5일 수준이다. 검증만(수정 제외)으로 좁히면 S로 떨어질 수 있다.
**의존성**: 로컬 스택 실행: pnpm dev (web:5173 + api:8787). 키는 apps/api/.env에 이미 존재(네이버·카카오·Anthropic) — 신규 키 불필요; 사람의 시각 인지 또는 테스터 환경의 스크린샷 캡처 — 이 워크플로 서브에이전트는 브라우저를 '볼' 수 없음(메모리 L25: '브라우저 시각 반복은 사용자 환경에서'); 선결 후보 없음(데이터층 검증은 이미 완료됨)
**리스크**: '라이트/다크' 항목 오스코프 위험: 라이트 테마는 코드에 미구현이며 DESIGN-SYSTEM §12.1이 M3 이후로 명시 보류함. index.css는 단일 다크 :root만 가짐. 따라서 이 항목은 '라이트 테마 정확성'이 아니라 'OS 라이트 모드가 다크 UI를 깨지 않는지'로 재정의해야 한다.; 수동 시각 QA는 비결정적·비CI다(QA-STRATEGY §6.1, §7: FPS·시각은 하드 게이트 아님). 테스터 GPU/브라우저에 따라 결과가 달라질 수 있음 → 환경 기록 필수.; WebGL headless 스크린샷은 플래키(§6.1) → 픽셀 스냅샷 자동화 금지. 수동/육안 또는 테스터 환경 스크린샷만 사용.; AC-7(빈 결과 + 추천 검색어 UI)이 App.tsx에 미구현(idle/loading/ready/error만 존재, 빈약 결과는 API mock 폴백). 빈 그래프 점검 시 이 공백이 드러날 수 있음 — 별도 후속 후보로 분리 권장.; 웹에 LOD/품질 티어 미구현(DESIGN-SYSTEM §11는 문서만). 대형 그래프 점검에서 성능/겹침 이슈가 보이면 별도 후속 작업 필요(이 후보 범위 밖).
**비용**: $0에 수렴. 순수 로컬 검증이며 OS/DevTools로 라이트·reduced-motion 토글(무료). 검색 실행 시 네이버(무료 25k/일)·위키(무료) 호출. Anthropic은 키 게이트라, 키 제거 시 휴리스틱 폴백으로 지출 0; 키 유지 시 고유 미캐시 쿼리당 ~$0.03–0.05이나 QA는 소수 고정 쿼리(예: 토스)로 30분 캐시 재사용 → 예산 $8.8 대비 무시 가능. 권장: 지출 완전 차단이 필요하면 QA 동안 ANTHROPIC_API_KEY 제거 후 폴백 그래프로 시각 점검.

### 7. i18n 구조 스캐폴딩 (ko만 노출)
`id: i18n-scaffolding-ko-only` · 노력 **M(중간)** · 🟢 착수 가능 · tier:next

**왜**: 중복

**수용 기준**:
- apps/web/src/i18n/ 신설: 타입드 메시지 카탈로그 ko(messages/ko.ts) + t(key, params?) 접근자 + Locale 타입(ko 기본, 'en'|'ja' 추가가 호출부 변경 없이 가능한 구조)이 존재한다.
- App.tsx·SearchBar.tsx·DetailPanel.tsx·CerebroLoader.tsx·SourceSummary.tsx·CategoryLegend.tsx의 모든 렌더링/aria/placeholder 문자열과 NODE_KIND_LABELS·NODE_USAGE_HINTS(lib/colors.ts)·SOURCE_TYPE_LABELS(lib/sources.ts)가 카탈로그를 통해 공급된다 — 해당 파일에서 렌더되는 한글 리터럴 grep 결과가 코드 주석만 남는다(CategoryIcon은 aria-hidden 주석뿐이라 스코프 제외).
- 다국어 누락이 타입으로 강제됨: 추가 로캘 카탈로그는 ko와 동일한 Record<MessageKey, string>을 만족해야 하며, 키 하나만 빠뜨려도 pnpm --filter web typecheck 실패(M3 '번역 누락 0' 가드 시연). 더불어 ko 카탈로그에 빈 값이 없음을 검증하는 단위테스트 1개 추가.
- 보간 동작: '분석된 출처 {count}건', '신뢰도 {percent}%' 가 params로 정확히 렌더되고 단위테스트로 커버. 날짜는 toLocaleDateString이 하드코딩 'ko-KR' 대신 현재 로캘에서 파생.
- ko만 노출: 언어 스위처 UI 없음, 활성 로캘은 ko 단일, index.html lang="ko" 유지.
- 기존 테스트(App.test '검색어' getByLabelText, SourceSummary.test '분석된 출처 3건')가 ko 기본값으로 그대로 통과하고, pnpm --filter web typecheck && test && lint && build 그린.
- lightweight 자체구현 vs 라이브러리(react-i18next 등) 선택 근거·트레이드오프를 ADR(docs/adr/00NN)로 기록하고 docs/STATUS.md 갱신.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/web/src/i18n/index.ts (신규: t() + Locale 타입 + 활성 로캘)`, `/Users/kang/Desktop/cerebro/apps/web/src/i18n/messages/ko.ts (신규: ko 메시지 카탈로그, MessageKey 타입 원천)`, `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/SearchBar.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/DetailPanel.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/CerebroLoader.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/SourceSummary.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/CategoryLegend.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/colors.ts (NODE_KIND_LABELS·NODE_USAGE_HINTS)`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/sources.ts (SOURCE_TYPE_LABELS)`, `/Users/kang/Desktop/cerebro/apps/web/src/App.test.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/SourceSummary.test.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/sources.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/index.html (lang/title/meta 확인·유지)`, `/Users/kang/Desktop/cerebro/docs/adr/0009-i18n-lightweight-scaffolding.md (신규)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 단일 앱(apps/web) 한정의 기계적 리팩토링이라 백엔드·shared·신규의존성 변경이 없다. 다만 6개 컴포넌트 + 3개 라벨맵에 걸친 ~30-40개 사용자 문자열을 카탈로그로 이전하고, 보간 헬퍼 + 타입 강제 구조 + 단위테스트 + 기존 테스트 정합성 + ADR/STATUS까지 포함하면 0.5d를 약간 넘긴다. 순수 chrome 문자열만이면 S에 근접하나 라벨맵 이전·ADR·테스트를 합쳐 M.
**의존성**: 없음
**리스크**: 스코프 폭주: 라벨맵 이전·코드 주석까지 건드리면 비대해짐 → 사용자 노출 문자열로 한정하고 코드 주석은 한국어 유지(보이스카웃 범위 고정).; 테스트 취약성: App.test/SourceSummary.test가 한글 리터럴을 단언 → ko를 기본/유일 로캘로 두어 통과 보장(선택적으로 카탈로그 참조로 단언해 중복 제거).; 오버엔지니어링(YAGNI 위반): ko 단독에 react-i18next/i18next/ICU 도입은 과함 → 무의존 타입드 카탈로그를 기본안으로 ADR에 근거화. 라이브러리 채택 시 번들·의존성 증가 트레이드오프 명시.; 보간/복수형: '분석된 출처 {count}건'·'{percent}%' 보간 필요(한국어는 복수형 없음 → 단순 치환으로 충분).; 카탈로그 위치 혼동: UI 문자열은 apps/web 소관, API의 LLM 리포트 본문 언어(프롬프트 한국어)는 별개 → shared로 끌어올리지 말고 web에 두며 M3 콘텐츠 i18n과 혼동 방지(ADR에 경계 기록).
**비용**: $0. 순수 프론트엔드 구조 작업으로 API/LLM 호출·키·트래픽이 전혀 없어 Anthropic 예산($8.8)에 영향 없음. 무의존 자체구현 선택 시 신규 npm 의존성·번들 증가도 없음(번들 중립). LLM 리포트 본문의 언어는 이 작업 범위 밖이라 비용 무관.

### 8. Playwright 핵심 E2E (DOM/접근성 계약)
`id: playwright-e2e-suite` · 노력 **L(큼)** · ⏸️ 트리거 대기 · tier:next

**왜**: ROADMAP M1 Exit ⑥("QA 핵심 시나리오·접근성(키보드·reduced-motion) 통과")의 마지막 안전망인데 현재 E2E spec 0개. 핵심 루프(검색→로딩→3D→상세)와 키보드/reduced-motion a11y 계약을 종단으로 검증하는 유일한 레이어다. 단, 조사 결과 헤드라인 여정(노드 클릭+키보드 탐색)은 지금 검증 불가다: apps/web/src/components/MindMapCanvas.tsx가 노드를 WebGL <mesh> 구체로만 렌더하고 DOM에 라벨/role/클릭 타겟/data-testid가 전혀 없다(CategoryLegend.tsx도 "3D 구체엔 텍스트 라벨이 없으므로"라고 명시). Playwright가 선택/포커스할 DOM이 없으므로 노드 클릭·키보드 spec은 접근성 DOM 레이어가 선행돼야 한다. 반면 검색→로딩→캔버스 마운트→오류 상태→reduced-motion→출처 요약 + axe 스캔은 지금 바로 작성 가능(선행 PR로 분리 착수 권장). 또한 AC-7 빈상태 UI는 App.tsx에 미구현(idle/loading/ready/error만 존재)이고 server.ts는 nodes<=1이면 buildMockGraph로 폴백해 빈 그래프를 반환하지 않으므로 빈상태 spec도 선행 의존이 있다.

**수용 기준**:
- 하네스: apps/web/playwright.config.ts 추가, webServer로 web 앱을 고정 포트(dev 또는 build+preview)로 띄우고 `pnpm --filter web e2e`가 headless Chromium에서 그린. 외부 네트워크 0회(모든 /api/search를 route 가로채기로 처리)
- 결정성/무비용: page.route('**/api/search', ...)로 모든 검색 호출을 fixture로 fulfill. fixture는 @cerebro/shared의 SearchResponseSchema.parse를 통과(계약 드리프트 시 테스트 실패). 실제 Fastify·네이버·카카오·Anthropic 호출 0회
- [지금 가능] 검색 여정 spec: role=search 입력(aria-label=검색어)에 쿼리 입력→'탐색' 제출→로더(role=status) 표시→그래프 컨테이너에 <canvas> 마운트 + SourceSummary '분석된 출처 N건' 노출 (AC-1)
- [지금 가능] 오류 상태 spec: route가 500 반환→role=alert 에러 메시지 표시, 앱 비크래시(#root에 콘텐츠 유지) (AC-7 인접)
- [지금 가능] reduced-motion spec: context reducedMotion:'reduce'에서 로더(정적 폴백) 렌더·콘솔 에러 없음 (AC-2)
- [지금 가능] @axe-core/playwright로 idle·ready 화면 스캔→critical/serious 위반 0 (QA §7.2)
- [의존: a11y DOM 노드 레이어] 노드 선택 spec: DOM 노드 레이어를 키보드 포커스/Enter(또는 클릭)→role=dialog DetailPanel 오픈, 5필드(요약·유형·신뢰도·활용법 또는 리포트·출처 a[target=_blank]) 존재, '닫기'(aria-label) 또는 Esc로 닫힘 (AC-3/AC-4)
- [의존: 빈상태 UI] 빈 결과 spec: 모킹된 빈/희박 응답→빈상태 안내+추천 검색어 노출, 비크래시 (AC-7)
- vitest 격리: vitest가 e2e spec을 수집하지 않게 처리(vite.config.ts test.exclude에 'e2e/**' 추가 또는 파일명 *.e2e.ts). `pnpm test`(PR 게이트)는 여전히 빠르고 결정적
- CI: E2E는 QA §8대로 별도 **비차단** 잡으로 추가(Playwright 브라우저 캐시 ~/.cache/ms-playwright, chromium 단독). M1 후반 차단 승격은 문서화. .github 변경은 Orchestrator 리뷰 요청
- spec은 AC-N 태깅(QA §4 추적성), 총 5~8개로 제한(QA §2 예산)

**건드릴 파일(예상)**: `apps/web/playwright.config.ts (신규)`, `apps/web/e2e/search-journey.e2e.ts (신규)`, `apps/web/e2e/states.e2e.ts (신규: 오류·reduced-motion·빈상태)`, `apps/web/e2e/a11y-keyboard.e2e.ts (신규: axe + 키보드 탐색)`, `apps/web/e2e/fixtures/search-response.ts (신규: SearchResponseSchema 통과 fixture)`, `apps/web/package.json (수정: @playwright/test·@axe-core/playwright devDep, e2e 스크립트)`, `apps/web/vite.config.ts (수정: test.exclude로 e2e 분리)`, `apps/web/src/components/MindMapCanvas.tsx (선행 의존 수정: 노드 접근성 DOM 레이어/포커스 가능 라벨/data-testid)`, `apps/web/src/App.tsx (선행 의존 수정: AC-7 빈상태 UI)`, `apps/web/src/components/SearchBar.tsx (검증 타겟: role=search, aria-label=검색어, '탐색')`, `apps/web/src/components/CerebroLoader.tsx (검증 타겟: role=status)`, `apps/web/src/components/DetailPanel.tsx (검증 타겟: role=dialog, 5필드, 닫기)`, `apps/web/src/components/SourceSummary.tsx (검증 타겟: '분석된 출처 N건')`, `apps/web/src/api/client.ts (route 글롭 '**/api/search' 근거: VITE_API_BASE_URL 기본 localhost:8787)`, `packages/shared/src/schemas/search.ts (fixture 계약 SSOT: SearchResponseSchema)`, `packages/shared/src/schemas/graph.ts (fixture 계약 SSOT: GraphSnapshotSchema)`, `.github/workflows/e2e.yml 또는 ci.yml (신규/수정: 비차단 E2E 잡 — Orchestrator 소유)`
**노력 근거**: pnpm 모노레포 Playwright 셋업(config·webServer·브라우저 설치)+route 모킹 fixture(shared 계약 준수)+5~8 spec+axe 통합+vitest 격리+CI 비차단 잡+브라우저 캐시까지 합치면 >1.5d. 더해 헤드라인 spec(노드 클릭·키보드·빈상태)은 선행 앱 변경(접근성 DOM 노드 레이어, AC-7 빈상태 UI)을 전제로 하므로 코디네이션 비용이 추가된다. 하네스+지금 가능한 4~5 spec만 떼어내면 M지만, 후보 전체 범위 기준 L.
**의존성**: a11y-dom-node-layer (신규 후보/선행조건): 3D 노드의 포커스 가능·라벨된 DOM 표현(drei <Html> 라벨 또는 visually-hidden 노드 리스트 또는 data-testid). QA §6.2 'DOM/접근성 계약'의 전제. 이게 없으면 노드 클릭·키보드 spec 불가; empty-state-ui-ac7 (신규 후보/선행조건): App.tsx 빈 결과 UI(안내+추천 검색어) + 모킹 가능한 빈 경로. 현재 server.ts는 buildMockGraph 폴백으로 빈 그래프를 반환하지 않음; 외부 선결조건: 없음(키 불필요, 브라우저 바이너리 다운로드는 무료)
**리스크**: WebGL이 headless Chromium에서 불안정(QA §2.1) → 픽셀/노드수를 캔버스에서 단언하지 말고 <canvas> 마운트 여부 + a11y DOM 레이어만 단언. 필요 시 swiftshader/신 헤드리스 모드 사용; vitest 기본 include('**/*.spec.ts')가 e2e spec을 잡아 PR 게이트에서 Playwright API 미정의로 깨질 수 있음 → test.exclude 또는 *.e2e.ts 네이밍 필수(load-bearing); 플래키 → Playwright auto-wait + route 모킹으로 결정성 확보, 임의 sleep 금지; CI 시간/비용 → 브라우저 캐시·chromium 단독·비차단 잡(QA §8). ci.yml에 이미 concurrency cancel-in-progress 있음; .github는 Orchestrator 소유 → PR에 영향 명시 + 리뷰 요청; 스코프 폭주: 접근성 DOM 레이어/빈상태 UI를 이 PR에서 같이 만들면 테스트 인프라와 앱 기능이 결합 → 별 PR/후보로 분리 권장
**비용**: Anthropic $8.8 예산에 영향 0: E2E가 /api/search를 네트워크 레벨에서 모킹해 실제 백엔드·네이버·카카오 쿼터·Claude 호출이 전혀 발생하지 않음(키 게이트/캐시 패턴과 무관하게 0원). Playwright·Chromium·axe-core 모두 무료 OSS, 카드 불필요(ADR-0005 무료 원칙 부합). 유일 비용은 무료 티어 CI 분(브라우저 캐시·chromium 단독으로 최소화). fixture는 합성 공개정보만 담아 민감정보 0(PIPA).
**트리거(해제 조건)**: 3D 그래프 노드의 접근성 DOM 레이어(포커스 가능 노드 리스트 또는 drei <Html> 라벨/ data-testid)가 도입되면 헤드라인 여정(노드 클릭→상세 패널, 키보드 탐색) spec이 검증 가능해진다. 빈상태 spec은 App.tsx AC-7 빈상태 UI가 추가되면 풀린다. 단, 하네스+검색/로딩/오류/reduced-motion/출처요약/axe spec은 트리거 없이도 선행 PR로 지금 바로 착수 가능(분리 권장).

### 9. 유료 기능 플래그 뒤 구현 (결제 미연동)
`id: paid-feature-flags-m2` · 노력 **L(큼)** · 🟢 착수 가능 · tier:later

**왜**: ROADMAP §4 M2 ⑥ + GTM §7-8이 정의한 Freemium(검색/노드 상한, 고급 필터, 저장/내보내기, 워터마크 제거, 우선 갱신)을 "스위치 OFF" 플래그 뒤에 선구현해 두면, M3에서 결제를 붙일 때 재구축이 아니라 설정 한 줄(플래그 ON) + 권한 매핑으로 끝난다. 가치: (1) 게이팅 UX·계약을 미리 검증해 M3 리스크 제거, (2) Free/Pro를 가르는 한도(현재 코드엔 일/월 검색 한도도, Free 전용 노드캡도 없음)를 명시적 계약으로 SSOT에 못박음, (3) 플래그 기본 OFF라 무료 운영(ADR-0005)·전원 무료 원칙을 깨지 않음. 핵심 자산은 packages/shared의 Plan/Entitlements zod 계약(재사용 가능한 등뼈)이며, 이는 env 키-게이트/폴백 패턴(ADR-0008)을 그대로 따른다.

**수용 기준**:
- packages/shared가 zod PlanSchema/EntitlementsSchema(FREE·PRO)를 export하고 구체 한도(searchesPerDay, maxGraphNodes, advancedFilters:boolean, export:boolean, removeWatermark:boolean, priorityRefresh:boolean)를 정의한다 — graph.test.ts 양식의 스키마 테스트가 FREE<PRO 한도 관계와 파싱을 검증하며 통과.
- apps/api/src/env.ts에 PREMIUM_FEATURES_ENABLED(zod coerce boolean, default false) 추가. 플래그 false면 entitlements 리졸버가 모든 요청에 FREE를 반환(현재 auth 없음 → per-user 플랜 없음) — 리졸버 단위 테스트가 플래그 OFF에서 항상 FREE 반환을 단언.
- 전달 경로 존재: GET /api/entitlements가 리졸브된 엔타이틀먼트를 shared 스키마로 검증해 반환 — server.test.ts가 플래그 OFF일 때 200 + FREE 형태를 단언.
- 최소 1개 기능이 플래그 뒤에서 end-to-end로 게이팅됨: graph/build.ts의 노드/브랜치 캡을 하드코딩(MAX_BRANCHES/GRAPH_LIMITS.MAX_NODES) 대신 엔타이틀먼트의 maxGraphNodes에서 읽음 — build.test.ts가 FREE 캡에서 노드가 잘리고 PRO 캡(또는 플래그 ON)에서 더 많은 노드가 나옴을 단언.
- web: 프리미엄 전용 UI(예: PNG 내보내기 버튼 또는 고급 필터 컨트롤)가 엔타이틀먼트에 해당 권한이 없으면 숨김 또는 disabled — App.test.tsx/컴포넌트 테스트가 FREE에서 컨트롤 부재/비활성을 단언.
- 내보내기/공유 산출물은 removeWatermark 권한이 없으면 GTM 워터마크('cerebro에서 직접 탐색 →')를 항상 포함 — 컴포넌트 테스트로 단언.
- 결제/PG 코드 0, 신규 외부 의존성 0, 신규 시크릿 0, 게이팅은 UI뿐 아니라 API에서도 적용(숨김만 하고 API 무방비 금지). pnpm lint·typecheck·test·build 그린, .env.example에 플래그 문서화, docs/adr/0009-paid-feature-flags.md 기록.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/plan.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/index.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/plan.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/entitlements.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/entitlements.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.test.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/api/client.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/App.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/components/DetailPanel.tsx`, `/Users/kang/Desktop/cerebro/.env.example`, `/Users/kang/Desktop/cerebro/docs/adr/0009-paid-feature-flags.md`
**노력 근거**: shared 계약(zod) → api 리졸버+env 플래그+/api/entitlements+노드캡 게이팅 → web 권한 페치+UI 게이팅+워터마크 까지 3패키지 종단 + 각 레이어 테스트 + ADR로 명백히 >1.5d. 축소 슬라이스(계약+플래그+노드캡만, web UI 제외)면 M까지 줄지만, 후보 정의가 '기능 선구현'이라 최소 1개 기능의 종단 게이팅을 포함해야 L로 본다. PDF·결제·per-user 플랜을 빼서 L 상단 폭주를 막는다.
**의존성**: account-auth-m2 (Supabase Auth, ROADMAP M2 ④ / ADR-0002): per-user 플랜의 전제. 없으면 플래그는 전역 스위치(전원 FREE)로만 동작 — 전역-플래그 슬라이스에는 하드 블로커 아님(soft); observability-analytics-m2 / cost-monitoring-m2 (ROADMAP M2 ①⑤): ROADMAP 순서상 BM 플래그보다 선행; 외부 선결조건 없음: 키·승인·트래픽 불필요(전역-플래그 슬라이스는 지금 빌드 가능)
**리스크**: YAGNI/조기구현: 수요·auth 확정 전 M3 표면을 만드는 리스크 → 플래그 기본 OFF + 메커니즘+1~2기능으로 스코프 고정, 계약 최소화로 완화; 계약 처닝: 결제/auth 도입 시 엔타이틀먼트 형태 변경 가능 → 스키마 최소·ADR로 버전 의도 명시; 보안: UI만 숨기고 API 미게이팅이면 프리미엄 우회 → 반드시 API(graph build·/api/entitlements) 경계에서도 게이팅; 워터마크 제거가 클라이언트에서 우회 가능하면 GTM 바이럴 귀속 훼손 → 워터마크는 자산 생성 경계에서 권한 검사; 스코프 크립(PDF 내보내기=무거운 의존성) → PNG(canvas.toDataURL)로 제한, 신규 의존성 0 유지
**비용**: LLM/결제 비용 영향 없음 — 플래그·필터·내보내기는 클라이언트 측 또는 순수 설정. 주의: '우선 갱신' 같은 기능이 30분 캐시를 우회하거나 추가 Claude 호출을 유발하면 안 됨(Anthropic $8.8 예산 보호). 신규 유료 API·카드 0, 키-게이트/캐시/폴백 패턴 유지. 결제는 M3로 명시 분리.

---

## DEFERRED · 외부 트리거 대기

_코드는 (대부분) 준비됐으나 외부 트리거(유료 결제·법인심사·상업계약·실트래픽 수요·예산 승인)가 충족돼야 착수/머지가 정당한 항목. 트리거 전에는 추적만 유지하고 죽은 코드 선구현 금지(YAGNI·무료/무카드·PIPA 골든룰)._

### 1. 광범위 웹검색 재도입 (Tavily 1순위) — SourceAdapter + safeFetch POST 확장
`id: tavily-web-search-adapter` · 노력 **M(중간)** · ⏸️ 트리거 대기 · tier:deferred

**왜**: value over time

**수용 기준**:
- 단위테스트(tavily.test.ts, brave.test.ts 패턴 미러): createTavilyAdapter({}).isEnabled()===false, {apiKey:'tok'}===true
- 비활성 어댑터 collect()가 빈 배열 반환
- Tavily 응답(results[])을 RawItem으로 매핑: title→title, url→url, content→snippet(stripHtml), published_date→publishedAt(ISO 파싱); url/title 누락·비URL 항목은 제외
- 주입 fetchImpl로 호출 검증: POST https://api.tavily.com/search 로 query를 body에 담고 API 키를 헤더(Authorization: Bearer) 또는 body로 전송
- safeFetch가 method:'POST'+JSON body를 지원하도록 확장하되, 기존 GET 동작·SSRF 가드(호스트 화이트리스트·사설호스트·IP리터럴·리다이렉트 차단)는 그대로 유지 — http.test.ts 기존 케이스 전원 통과 + POST body 전달/가드 적용 신규 케이스 추가
- TAVILY_API_KEY 미설정 시 registry.getEnabledAdapters()에 tavily 미포함, 설정 시 포함(isEnabled 게이트)
- pnpm typecheck && pnpm test && pnpm lint && pnpm build 그린
- 라이브 스모크(키 설정 시): /api/search 응답 graph.sources 에 'web' 유형(Tavily 출처)이 naver/wikipedia와 함께 등장, 재요청 시 cached=true

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/sources/tavily.ts (신규 — 템플릿: git show 18def1b:apps/api/src/sources/brave.ts)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/tavily.test.ts (신규 — 템플릿: brave.test.ts)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts (tavilyAdapter 등록)`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts (TAVILY_API_KEY optionalSecret 추가)`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/http.ts (safeFetch method+body 지원 확장 — POST 필요)`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/http.test.ts (POST/body/SSRF 가드 테스트)`, `/Users/kang/Desktop/cerebro/.env.example (TAVILY_API_KEY= 빈 플레이스홀더)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md (소스 어댑터 상태표·§4·§6 갱신)`, `/Users/kang/Desktop/cerebro/docs/adr/0005-defer-broad-web-search.md (재도입 결정 추가 또는 후속 ADR로 supersede)`, `(선택, 전용 배지 채택 시) /Users/kang/Desktop/cerebro/packages/shared/src/constants.ts(SOURCE_TYPES에 'tavily'), /Users/kang/Desktop/cerebro/apps/web/src/lib/sources.ts(SOURCE_TYPE_LABELS), /Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts(BASE_CONFIDENCE)`
**노력 근거**: 어댑터+테스트 자체는 거의 자명(Brave 어댑터가 git 히스토리에 템플릿으로 남아 있고 SourceAdapter 추상화로 SSRF·캐시·폴백 자동 상속). 그러나 Tavily 검색 API는 POST+JSON body 방식인데 현재 safeFetch는 method:'GET' 하드코딩에 body 옵션이 없다(apps/api/src/lib/http.ts:85-90) — 공유 HTTP 경계를 SSRF 가드 보존하며 확장하고 테스트해야 한다. 이 부분이 후보 한 줄의 '파일 1개' 주장보다 작업이 늘어나는 핵심 델타. 그래도 전체는 1.5d 미만이라 M. 출처유형은 기존 'web'(label '웹', confidence 0.55가 이미 존재)을 재사용하면 shared/web 무변경(YAGNI), 전용 'tavily' 배지를 원하면 enum+label+confidence+테스트가 추가돼 상단으로 붙음.
**의존성**: 외부 트리거: ADR-0005 재도입 조건 — 실제 트래픽/사용자 피드백으로 '광범위 웹검색이 필요'가 확인될 것; 외부 선결조건: TAVILY_API_KEY 발급(tavily.com 무료 가입, 카드 불요) → apps/api/.env 주입; 느슨한 연관: apps/api/src/analyze/report.ts(LLM 활용 리포트) — 출처 후보 풀에 Tavily 결과가 더해지나 MAX_SOURCES=18 상한으로 토큰 영향 제한적
**리스크**: safeFetch POST 확장이 공유 경계 변경 → 전 어댑터(wikipedia/naver/kakao) 호출 경로에 영향. SSRF 가드(호스트 화이트리스트·사설호스트·리다이렉트 차단) 회귀 방지 테스트 필수; PIPA: Tavily는 글로벌/영문 웹을 반환 → 비공인 개인정보 노출 가능성이 국내 API보다 높음. collect/pii.ts 마스킹(주민번호·휴대전화)은 best-effort이고 1차 방어는 '공개정보·공인 한정' 정책 — 한국어 외 개인정보는 마스킹 사각; Tavily 무료 1,000건/월은 계정 단위 공유 쿼터. 트래픽 증가 시 소진 가능 → 30분 캐시로 완화하되 초과 시 어댑터 실패 허용(allSettled)로 그레이스풀 폴백 확인 필요; Tavily API 응답 스키마(results[].content / published_date 등)는 외부 계약 — zod 경계 검증 없이 인터페이스 캐스팅만 하면 형식 변경에 취약(naver/brave 어댑터도 동일 수준이라 일관성은 유지되나 명시); ADR-0005가 '보류'를 Accepted로 못박았으므로, 재도입은 새 ADR(또는 0005 supersede)로 결정 근거를 남겨야 문서 정합성 유지
**비용**: Tavily 무료 월 1,000건·카드 불요로 무료·무카드 원칙(ADR-0005) 준수, 직접 과금 0. Anthropic 예산 $8.8과 무관(별도 키 게이트): Tavily 출처가 늘어도 report.ts가 MAX_SOURCES=18·MAX_TOKENS=4000으로 상한을 두어 Claude 토큰 증가는 경계됨. ANTHROPIC_API_KEY 미설정 시 휴리스틱 폴백(지출 0)은 그대로 유지. 30분 캐시로 동일 쿼리 재요청 시 Tavily 호출 0.
**트리거(해제 조건)**: 실제 트래픽/사용자 피드백으로 '글로벌·영문 교차검증(광범위 웹검색)이 필요'가 확인될 때(ADR-0005 재도입 트리거). 그 시점 무카드 무료 옵션이 Tavily이면 즉시 착수(키 발급 → 어댑터 1개 + safeFetch POST 확장). 트리거 전이라도 키 확보 시 기술 구현 자체는 ready(blocked 아님).

### 2. Supabase Auth 도입 (M2 진입) — 인증 기반 스캐폴딩
`id: supabase-auth-m2` · 노력 **L(큼)** · ⏸️ 트리거 대기 · tier:later

**왜**: ADR-0002가 정의한 M2 진입의 관문 작업. 저장·공유·검색히스토리 같은 개인화 기능과 남용 추적의 전제 조건이다. 다만 현재는 코드/의존성/DB가 전무하고(`@supabase/supabase-js` 미설치, env.ts에 SUPABASE_* 미검증, supabase/ 디렉토리·마이그레이션 없음), M1은 설계상 익명이며 백로그(STATUS §5)는 전부 M1 정제 항목이라 인증을 붙일 사용자向 기능이 아직 없다. 가치는 'M2 기능을 열 수 있는 토대' 자체이며, 토대만으로는 UX 가치가 0이라 시점 판단이 핵심.

**수용 기준**:
- env.ts(zod)가 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY(+필요시 SUPABASE_ANON_KEY)를 검증한다 — production에서 누락 시 부팅 실패(명확한 메시지), dev/test에서는 optional이라 익명 모드가 깨지지 않는다 (부팅 테스트로 확인)
- Fastify 인증 훅: Authorization: Bearer <jwt> 가 있으면 Supabase auth.getUser()로 검증해 request에 user를 부착, 만료/위조 토큰은 ApiError 스키마로 401, 헤더 부재 시 익명으로 통과한다 (server.test.ts app.inject로 유효/위조/부재 3케이스 검증)
- POST /api/search 가 Authorization 헤더 없이도 기존과 동일하게 동작한다 — M1 익명 검색 회귀 0 (기존 테스트 그린 유지 + 신규 케이스)
- web: VITE_SUPABASE_* 로 브라우저 supabase 클라이언트 생성, 로그인 UI(이메일 매직링크/비밀번호 + 최소 1개 OAuth) 렌더, 세션 존재 시 searchCerebro가 Authorization: Bearer 를 전송한다
- DB: 생성한 모든 테이블에 RLS 활성 마이그레이션 1개 이상(supabase/migrations/*.sql), anon/authenticated 최소권한 정책, service_role 키는 서버 전용 — VITE_ 변수/클라이언트 번들에 service_role 부재(grep 검증)
- pino logger에 redact 설정(authorization·cookie·*.email·*.token) 추가 (SECURITY §10)
- CI 그린(lint·typecheck·test·build) + gitleaks 통과, .env.example 갱신, 시크릿 미커밋
- JWT 검증 방식·검색 익명 유지(선택적 인증)·OAuth 공급자 선택을 기록한 ADR 추가

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/env.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/server.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/lib/supabase.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/plugins/auth.ts`, `/Users/kang/Desktop/cerebro/apps/api/package.json`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/supabase.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/components/AuthPanel.tsx`, `/Users/kang/Desktop/cerebro/apps/web/src/api/client.ts`, `/Users/kang/Desktop/cerebro/apps/web/src/vite-env.d.ts`, `/Users/kang/Desktop/cerebro/apps/web/package.json`, `/Users/kang/Desktop/cerebro/packages/shared/src/schemas/auth.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/index.ts`, `/Users/kang/Desktop/cerebro/supabase/migrations/`, `/Users/kang/Desktop/cerebro/.env.example`, `/Users/kang/Desktop/cerebro/docs/adr/0009-supabase-auth-impl.md`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`, `/Users/kang/Desktop/cerebro/docs/SECURITY.md`
**노력 근거**: shared 계약 + api(env·supabase 클라이언트·JWT 훅·테스트) + web(클라이언트·인증 컨텍스트/UI·client.ts 헤더) + DB 마이그레이션·RLS 정책 + 외부 Supabase 프로젝트/OAuth 설정 + ADR/문서까지 5개 영역에 걸친다. 기존 DB/Repository 레이어가 전무해 영속 인프라를 처음부터 세워야 하며 익명 회귀 방지까지 필요 → 단일 세션 초과(>1.5d). env+클라이언트 배선 → JWT 훅 → web 로그인 UI → RLS 마이그레이션으로 분할 권장.
**의존성**: 외부: Supabase 무료 프로젝트 생성 + URL/anon/service_role 키 프로비저닝(소유자 액션, 무카드); 외부(OAuth 채택 시): Google OAuth 클라이언트 ID/secret + 동의화면 구성; 인증을 붙일 첫 기능 후보(saved-graphs/search-history/share-link) 우선순위 확정 — 없으면 토대만 생겨 UX 가치 0; (연성) DB/Repository 레이어 부재 — RLS는 영속 데이터 도입 시점부터 의미. JWT 검증 자체는 DB 불필요라 선행 가능
**리스크**: 대형 L 작업의 스코프 폭주 — 분할 안 하면 PR 비대화. 4단계로 쪼갤 것; PIPA: Supabase Auth가 사용자 이메일(계정 PII) 저장 — 이는 '공인·공개정보 한정' 수집 대상과 별개의 계정정보지만, RLS·최소 프로필·로그 마스킹 필요. 현재 server.ts logger에 redact 미설정이라 이메일이 로그에 샐 위험; 벤더 종속(Supabase) — ARCHITECTURE의 Repository 패턴/얇은 래퍼로 격리; auth.getUser()는 요청마다 GoTrue 네트워크 호출 → 익명 검색까지 게이트하면 지연 증가. 검색은 선택적 인증으로 유지(헤더 없으면 통과). 로컬 JWT 검증(jose)이 성능 대안이나 SECURITY §6은 getUser() 명시 → ADR로 트레이드오프 기록; M1 익명 회귀 위험 — 인증은 반드시 가산적/선택적으로, 기존 /api/search 흐름 보존; 무료 티어 한계(MAU·커넥션) — 현재 규모는 무방하나 M2 모니터링 항목
**비용**: Supabase 무료 티어는 카드 불필요 → ADR-0005 무료·무카드 원칙 충족. 이메일/OAuth 인증 모두 무료. 인증은 Claude 호출과 무관 → Anthropic 예산 $8.8 영향 0(키 게이트·캐시·폴백 패턴 불변). 유일한 비용 신호는 무료 티어 MAU/커넥션 상한이며 현 트래픽에선 $0 유지.
**트리거(해제 조건)**: ADR-0002의 M2 진입 신호 충족(트래픽/남용이 무료 티어 안정선 근접·상시 초과) 또는 저장·검색히스토리·공유링크 같은 구체적 개인화 기능을 우선순위로 착수하기로 결정 — 둘 중 하나 + 소유자가 Supabase 무료 프로젝트와 URL/anon/service_role 키(OAuth 채택 시 Google OAuth 자격증명 포함)를 프로비저닝하면 즉시 착수 가능.

### 3. 형태소 분석기(kiwi-nlp) 재검토 — 측정 기반 평가 후 복합명사·품사 필터 도입 GO/NO-GO
`id: korean-morphological-analyzer-eval` · 노력 **L(큼)** · ⏸️ 트리거 대기 · tier:deferred

**왜**: 현재 토큰화는 의존성 0 규칙(받침 이형태 + 보호사전, ADR-0004)이라 "복합명사 분해·품사 필터·원형 복원"을 못 한다. STATUS §6이 명시한 잔여 한계 — 보호 단어 사전이 비완전(신규 ~家/~이/~과/~주의 오탐), 복합명사 미분해. 토픽 노드는 키워드 빈도(score.ts → build.ts concept 노드)로 만들어지므로 토큰 품질이 곧 마인드맵 가지 품질이다. kiwi-nlp는 ADR-0004가 "유일한 합리적 업그레이드 경로"로 지목한 근본 해결책이나, 무측정 도입은 프로젝트 YAGNI 룰 위반이다. 이 작업의 가치는 '규칙 한계'를 추측이 아닌 라벨 코퍼스 정밀도/재현율 수치로 증명하고, kiwi 스파이크의 비용(콜드스타트·메모리·라이선스)을 실측해 GO/NO-GO를 데이터로 결정하는 것이다.

**수용 기준**:
- 라벨 적대적 코퍼스(기존 korean.test.ts 케이스 + 실쿼리 유래 신규 케이스: true-positive 조사 / false-positive 보호어 / 복합명사 / 품사 노이즈)를 픽스처로 커밋하고, 현재 규칙 tokenizer의 precision/recall(특히 오절단 FP율)을 산출하는 스크립트/테스트로 베이스라인 수치를 기록한다
- kiwi-nlp(wasm)를 env 플래그(예: TOKENIZER=kiwi) 뒤 프로토타입으로 통합해 동일 코퍼스에 대해 품사 필터(명사류만)·복합명사 분해·원형 복원을 적용하고, 규칙 대비 precision/recall A/B 수치를 기록한다
- 콜드스타트 init 시간, 피크 메모리 증가분, node_modules/wasm 용량을 실측해 무료 호스트(tsx 런타임, 번들러 없음) 제약과 함께 기록한다
- LGPL-2.1 라이선스가 현 배포 모델(npm 동적 링크)과 호환되는지 확인해 ADR에 명시한다
- 오프라인·무키 동작 검증: kiwi 경로가 API 키·네트워크 없이 동작함을 확인한다(ADR-0005 무료·무카드, Anthropic 예산 무영향)
- ADR-0004를 갱신(또는 대체 ADR 작성)해 측정된 A/B 비교표와 GO/NO-GO 권고를 남기고, GO인 경우 동기 tokenize() → 사전 워밍 싱글톤(또는 async 리플) 통합 경로를 명시한다
- pnpm typecheck && pnpm test && pnpm lint && pnpm build 전체 그린 유지. 채택 시 korean.test.ts/pipeline.test.ts를 새 tokenizer 출력에 맞춰 갱신해 통과시킨다
- 복합명사 분해가 브랜드명(예: 당근마켓→당근/마켓)을 과분할해 새 파편화 클래스를 만들지 않는지 코퍼스로 확인(과분할 발견 시 보호/설정으로 차단)

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/collect/korean.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/score.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/build.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/korean.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/pipeline.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts`, `/Users/kang/Desktop/cerebro/apps/api/package.json`, `/Users/kang/Desktop/cerebro/docs/adr/0004-korean-josa-rule-tokenizer.md`, `/Users/kang/Desktop/cerebro/docs/STATUS.md`
**노력 근거**: 단순 라이브러리 교체가 아니라 의사결정 스파이크: (1) 라벨 코퍼스 구축 + 규칙 베이스라인 측정 ~0.3d, (2) kiwi wasm 통합(async init·품사 필터·복합명사·원형 복원) 플래그 뒤 프로토타입 ~0.5d, (3) 실쿼리(토스 등) A/B 하니스 ~0.3d, (4) 콜드스타트·메모리·용량·라이선스 실측 ~0.3d, (5) ADR 갱신·권고 ~0.2d. tokenize()가 동기 API(normalize.ts:85, build.ts:187 두 곳)라 채택 시 async 리플 또는 워밍 싱글톤 설계가 추가 비용. 합산 >1.5d → L. (트리거 미충족이면 (1)만 떼어 S로 선행 가능)
**의존성**: 트리거: ADR-0004/STATUS §6의 '토픽 품질이 규칙 한계에 부딪힘'이 측정/관측으로 확인되어야 본 평가 착수의 정당성 확보(외부 키·승인·과금 선결조건은 없음 — kiwi는 무료·오픈소스·무네트워크)
**리스크**: LGPL-2.1: 현 배포(npm 동적 링크) 의무가 수용 가능한지 확인 필요 — 미확인 시 채택 차단; ~4MB wasm + 기동 시 모델 로드 → 무료 호스트(번들러 없이 tsx 런타임)에서 콜드스타트 지연·메모리 초과 위험; 동기 tokenize()(normalize.ts:85, build.ts:187)를 async로 바꾸면 수집 파이프라인 전반에 리플 — 워밍 싱글톤으로 동기 파사드 유지하지 않으면 변경 범위 폭증; 토픽/카테고리 그래프 출력 변동 → korean.test.ts·pipeline.test.ts·build.test.ts 회귀 갱신 필요; YAGNI 위반 위험: ADR-0004가 명시적으로 보류했으므로 측정 증거 없이 채택하면 코딩 표준(조기 추상화·불필요 의존성) 위반 — 반드시 수치 선행; 복합명사 분해가 고유 브랜드/제품명을 과분할해 기존에 해결한 파편화를 역으로 재도입할 수 있음
**비용**: Anthropic 예산 $8.8 무영향: kiwi-nlp는 로컬 인프로세스(wasm) NLP로 API 호출·키·네트워크가 없다(키 게이트/캐시/폴백 패턴은 analyze/report.ts의 LLM 경로에만 해당, 본 작업과 직교). ADR-0005 무료·무카드 원칙 부합(오픈소스, 카드 불필요). 실질 비용은 금전이 아니라 번들 용량(~4MB)·콜드스타트·무료 호스트 메모리뿐 — 이를 실측해 감수 가능 여부를 판정하는 것이 본 평가의 핵심.
**트리거(해제 조건)**: 다음 중 하나가 관측되면 착수: (a) 보호 단어 사전 유지보수 부담 누적 — 실쿼리에서 신규 ~家/~이/~과/~주의 오절단이 반복 보고됨, (b) 복합명사 분해·원형 복원을 요구하는 제품 기능 또는 실트래픽에서 측정된 토픽 정밀도 저하(합의된 임계값 미달), (c) 증거 기반 병합(ADR-0004 §대안)으로도 못 푸는 파편화 사례 축적. 그 전까지 ADR-0004 규칙 기반 유지. (선행 가능: 트리거 전이라도 AC#1의 라벨 코퍼스+규칙 베이스라인 측정만 S 규모로 떼어내면 트리거 판정의 객관 지표를 미리 확보할 수 있음)

### 4. X(트위터) 소스 어댑터 — 예산 게이트 뒤 보류 (착수 트리거 대기)
`id: x-twitter-source-adapter-gated` · 노력 **M(중간)** · ⏸️ 트리거 대기 · tier:deferred

**왜**: SNS 실시간 여론은 ADR-0007에서 명시적으로 직접 지목된 요구("X·인스타·페북 정보도 가져오고 싶다")인데, X만 유일하게 "유료 구독+카드로 기술적으로는 도입 가능"한 후보다(인스타=법인심사, 페북=공개검색 API 부재로 사실상 불가). 즉 SNS 커버리지 공백(STATUS §6)을 메울 수 있는 유일한 현실적 경로. 다만 무료 읽기 불가(읽기 $0.005/post, 월 ~$30~100)라 프로젝트의 무료·무카드 하드원칙(ADR-0005/0007)과 정면 충돌 → 지금은 코드를 만들지 않고 '보류 상태를 정확히 추적'하고, 예산 승인 시 1파일로 켤 수 있게 명세만 고정해 두는 것이 가치. 어댑터 추상화가 이미 성숙(kakao.ts 템플릿)하고 sns SourceType·한글 배지가 이미 존재해 재도입 비용이 작다는 점이 핵심.

**수용 기준**:
- [지금/추적] 보류 상태가 단일하게 추적됨: ADR-0007·STATUS §6·registry.ts 주석이 모두 'X=유료 전용, 예산 게이트 뒤 보류'로 일관 기술되고, 코드에 라이브 X 호출이 없음(grep 'api.x.com|api.twitter.com' over apps/api/src 결과 0건).
- [지금/추적] 트리거 조건(예산 승인+카드+X 유료구독+Bearer 토큰)이 문서에 명시되고, 미충족 시 착수 금지가 적힌 상태.
- [트리거 충족 후/빌드] X_BEARER_TOKEN 미설정 또는 X_ADAPTER_ENABLED!=='true'이면 createXAdapter().isEnabled()===false 이고 registry에서 제외되어 /api/search가 X를 0회 호출(테스트로 단언).
- [빌드] 토큰+플래그 둘 다 설정된 경우에만 활성; collect()가 Authorization: Bearer <token> 헤더로 /2/tweets/search/recent 를 호출하고 응답을 sourceType:'sns'로 매핑(mocked fetch 테스트, kakao.test.ts 구조 모방).
- [빌드] 월 누적 읽기 post 수가 X_MONTHLY_POST_CAP 초과 시 collect()가 빈 배열 반환(추가 과금 0) — 테스트로 검증.
- [빌드] SSRF allowHosts에 X 호스트만 포함, http(s)만 통과, 항목이 기존 collect/pii.ts 마스킹 경계를 거침(통합 경로 재사용).
- [빌드] sns SourceType 재사용으로 packages/shared·apps/web 배지 변경 0(이미 존재) → pnpm typecheck 그린.
- [빌드] pnpm typecheck && pnpm test && pnpm lint && pnpm build 그린, apps/api/src/sources/x.test.ts 추가.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/sources/x.ts (신규 — kakao.ts 템플릿 복제: Bearer 헤더 인증, safeFetch+rate-limit+withRetry, isEnabled 게이트)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/x.test.ts (신규 — kakao.test.ts 구조 모방: 게이트/빈배열/헤더/매핑/상한)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts (게이트된 어댑터 등록 — 현재 [wikipedia, naver, kakao])`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/kakao.ts (구현 레퍼런스 — 키게이트 헤더인증 어댑터의 1:1 템플릿)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/types.ts (SourceAdapter/RawItem 계약 — 변경 불필요)`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts (X_BEARER_TOKEN=optionalSecret, X_ADAPTER_ENABLED 플래그, X_MONTHLY_POST_CAP 추가)`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts (SOURCE_TYPES에 'sns' 이미 존재 — 변경 불필요, 재사용)`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/sources.ts (sns:'SNS' 배지 이미 존재 — 변경 불필요)`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/pii.ts (민감정보 마스킹 경계 — UGC 유입 시 자동 재사용)`, `/Users/kang/Desktop/cerebro/.env.example (X_BEARER_TOKEN/X_ADAPTER_ENABLED/X_MONTHLY_POST_CAP 플레이스홀더 + 유료 경고 주석)`, `/Users/kang/Desktop/cerebro/docs/adr/0007-social-community-sources.md (게이트 메커니즘·트리거 갱신)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md (§6 보류 추적 갱신)`
**노력 근거**: 어댑터 본체는 kakao.ts 템플릿 복제+엔드포인트/필드 매핑 교체라 S(<0.5d) 수준. 그러나 (1) 현재 repo에 없는 '월 누적 지출/읽기 상한 추적기+자동 차단'을 새로 만들어야 하고(report.ts는 호출당 토큰캡만 보유, 누적 스펜드 트래커 부재), (2) 토큰+명시 플래그 이중 게이트로 우발 과금을 막아야 하며, (3) X는 글로벌 UGC라 PIPA(공인·공개정보 한정·민감정보) 가드를 더 엄격히 검토해야 해 합산 M(0.5~1.5d). 단, 이는 '트리거 충족 후' 추정치이며 지금 당장의 추적 작업만은 S 미만.
**의존성**: 외부: 예산 승인(월 ~$30~100+, X Basic 티어 가격은 변동성 큼 → 빌드 시점에 실가격·ToS 재확인 필수); 외부: 결제 카드 확보 — 무료·무카드 하드원칙(ADR-0005/0007)과 충돌하므로 Project Owner 승인 필요; 외부: X 개발자 유료 구독 + App-only OAuth2 Bearer 토큰 발급; 외부(소프트): 실트래픽으로 SNS 실시간 여론 수요 입증(YAGNI 방어 — 트래픽 없으면 보류 유지); 내부(소프트): 월 지출 상한/사용량 메트릭 인프라(STATUS §5.9 '후속 후보: LLM 사용량/비용 메트릭+자동 상한')와 상한 로직 공유 가능 — 먼저 만들어지면 재사용
**리스크**: 과금 폭주: 플래그가 토큰만으로 켜지거나 캐시/상한 없이 호출되면 월 $100 초과 가능 → 이중 게이트(토큰+X_ADAPTER_ENABLED)+월 누적 상한+30분 캐시를 라이브 호출 전 반드시 선행.; PIPA: X는 글로벌 UGC라 비공인 개인·민감정보 유입 위험이 국내 커뮤니티보다 높음 → 공인·공개정보 한정 정책 1차 방어 + collect/pii.ts 마스킹, SNS 특유 민감 콘텐츠는 best-effort 필터 한계 명시.; X API 가격·ToS 변동성: 티어명/한도/단가가 자주 바뀜(ADR의 $30~100는 2026-06 기준 추정) → 이 명세값을 신뢰하지 말고 착수 시점 재검증.; YAGNI 위반: 켤 수 없는 유료 어댑터를 미리 빌드하면 coding-standards(가설적 미래요구 추상화 금지) 위반 → 트리거 충족 전 코드 작성 금지, 지금은 추적만.; 무료·무카드 원칙 충돌: 카드 요구 자체가 프로젝트 하드원칙과 배치 → 도입 결정은 ADR로 명시 기록 필요.
**비용**: X 읽기 API는 무료 티어 불가(읽기 $0.005/post → 월 ~$30~100, ADR-0007). 이 비용은 Anthropic 예산 $8.8과 완전히 별개이며 그 예산을 건드리지 않는다(LLM 분석은 report.ts 키게이트·폴백으로 0원 폴백 가능 유지). 지금 권고 작업(보류 상태 추적·트리거 명시)은 외부 API 호출 0, 비용 $0. 실제 어댑터 빌드/가동은 별도 카드·유료 구독 승인이 선결조건이며 그 전까지 지출 0을 보장한다.
**트리거(해제 조건)**: 아래 셋이 모두 충족될 때만 빌드 착수: (1) Project Owner의 명시적 예산 승인(월 X API 유료 구독비) + 결제 카드 확보, (2) X 유료 구독으로 발급된 Bearer 토큰 확보, (3) 실트래픽으로 SNS 실시간 여론 수요 입증. 하나라도 없으면 코드 작성 금지하고 추적만 유지. (참고: 무료 대안은 존재하지 않으므로 '무료화'는 트리거가 될 수 없음.)

### 5. Reddit 소스 어댑터 — 상업 계약·PIPA 게이트 보류(추적 정비)
`id: reddit-source-adapter-gated` · 노력 **S(작음)** · ⏸️ 트리거 대기 · tier:deferred

**왜**: 요청된 SNS/커뮤니티 커버리지 확장 흐름(ADR-0007)의 미결 항목. 다만 Reddit Data API는 무료=비상업 한정이라 상업 서비스인 cerebro엔 별도 유료 계약이 필요(무료·무카드 원칙 ADR-0005 위배)하고, 콘텐츠 대부분이 가명 비공인 개인·비한국어라 '공인·공개정보 한정' PIPA 하드룰과 충돌한다. 게다가 reddit.com은 이미 category-rules의 community 도메인에 포함돼 기존 검색(카카오 web 등) 경유로 일부가 community 배지로 들어오므로 전용 어댑터의 한계비용 대비 가치가 낮다. 따라서 지금의 가치는 '구현'이 아니라 '보류 사유·트리거를 핸드오프에 정확히 추적'하는 것 — 현재 STATUS.md는 X/인스타/페북만 보류로 표기하고 Reddit은 ADR-0007 표에만 묻혀 있다.

**수용 기준**:
- STATUS.md §1 소스 어댑터 표와 §6 알려진 한계에 Reddit이 'deferred-with-trigger(상업계약+예산+PIPA 공인범위)'로 명시 추적된다 — grep -ni reddit docs/STATUS.md 에서 새 항목이 보이고, Facebook은 '공개검색 API 부재로 어댑터 미생성'으로 함께 재확인된다.
- ADR-0007의 Reddit 판정 행에 게이트 해제 트리거 3종(상업/엔터프라이즈 계약 체결, 예산 승인, PIPA 검토상 공인·공개정보 한정 범위 강제 가능)이 명문화된다.
- 보류 불변 검증: 상업 계약·예산 미확보 상태에서는 apps/api/src/sources/registry.ts 의 ADAPTERS 배열에 reddit 어댑터가 등록되지 않는다(레지스트리 grep로 reddit 부재 확인).
- (게이트 해제 시 전제) reddit.ts 는 SourceAdapter 계약을 구현하고 requiresKey=true·REDDIT_CLIENT_ID/SECRET 미설정 시 isEnabled()=false 라 registry에서 자동 제외 — reddit.test.ts 가 '키 없으면 isEnabled()=false 및 collect()=[]'를 검증한다(kakao.test.ts 패턴 준용).
- (게이트 해제 시 전제) sourceType 은 기존 'community'를 재사용해 packages/shared/src/constants.ts SOURCE_TYPES·web 라벨·색 팔레트 변경이 발생하지 않는다(reddit.com 이 이미 category-rules community에 있음과 정합).
- (게이트 해제 시 전제) 수집 항목이 collect/normalize.ts 경계에서 PII 마스킹·http(s) 스킴 가드를 자동 상속하고, 공개 서브레딧/공인 계정 화이트리스트로 범위가 제한되며, pnpm typecheck && pnpm test && pnpm lint && pnpm build 가 그린이다.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/docs/STATUS.md`, `/Users/kang/Desktop/cerebro/docs/adr/0007-social-community-sources.md`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/types.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/kakao.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/reddit.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/reddit.test.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts`, `/Users/kang/Desktop/cerebro/.env.example`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/normalize.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/collect/pii.ts`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/category-rules.ts`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts`
**노력 근거**: 지금 착수 가능한 범위는 '보류 추적 정비'뿐(STATUS.md/ADR-0007 문서 갱신, 코드·비용 변화 없음) → S(<0.5d). 실제 어댑터 구현은 게이트가 풀린 뒤의 작업으로, kakao.ts(약 130줄)+test+registry+env+.env.example 수준의 M(0.5~1.5d)이며 'community' 타입 재사용 시 shared 계약 변경이 없어 상한은 낮다. 다만 상업 계약·PIPA 검토가 선행되어야 하므로 지금의 effort는 문서 추적 기준 S로 산정.
**의존성**: 외부: Reddit Data API 상업/엔터프라이즈 계약 체결(영업 문의·유료, 가격 비공개); 외부: 해당 계약 비용에 대한 예산 승인(현재 무료·무카드 원칙 ADR-0005와 충돌); 외부: PIPA 법무 검토 — '공인·공개정보 한정' 범위(공개 서브레딧/공인 계정 화이트리스트)가 강제 가능하다는 확인; 선행: 실사용 트래픽 발생으로 영문/글로벌 소스 수요가 입증될 때(YAGNI 해제 신호)
**리스크**: PIPA 하드룰: Reddit 콘텐츠는 가명·비공인 개인·대부분 비한국어 → '공인·공개정보 한정' 강제가 어려워 비공개 개인 프로파일링 위험.; ToS/상업 게이트: 무료 티어를 상업 서비스에서 사용하거나 계약 없이 어댑터를 출시하면 Reddit ToS 위반(법적 리스크).; 낮은 한계가치: 한국어 커버리지 약함 + reddit.com 이 이미 category-rules community 도메인에 있어 기존 검색 경유로 일부 유입 → 전용 어댑터가 중복 가치가 됨.; 예산·무카드 충돌: 상업 계약은 결제 수단을 요구해 ADR-0005의 무료·무카드 운영 원칙을 깬다.; 스코프 크립: 신규 'reddit' SOURCE_TYPE 추가 시 shared 계약·web 라벨·색 팔레트까지 연쇄 변경 → 'community' 재사용으로 회피해야 함.
**비용**: 지금 범위(문서 추적)는 비용 0. 어댑터 자체는 Claude를 쓰지 않으므로 Anthropic $8.8 예산에 직접 영향 없음(활용 리포트는 검색당 1회 호출·18건 상한이라 소스 수와 무관). 단 상업 이용은 Reddit Data API 유료 계약(가격 비공개·카드 필요)이 필수라 무료·무카드 원칙(ADR-0005)에 정면 배치 — 예산 별도 확보 전엔 구현·머지 금지.
**트리거(해제 조건)**: (1) Reddit Data API 상업/엔터프라이즈 계약 체결 + (2) 해당 비용 예산 승인 + (3) PIPA 검토에서 '공인·공개정보 한정' 범위(공개 서브레딧/공인 계정 화이트리스트) 강제 가능 확인 — 셋이 모두 충족될 때만 어댑터 구현 착수. 그 전까지는 STATUS.md/ADR-0007의 보류 추적 정비만 수행한다. (Facebook은 공개검색 API 부재로 트리거와 무관하게 영구 미도입.)

### 6. Instagram 소스 어댑터 — 법인 인증 게이트로 보류(추적 유지)
`id: instagram-source-adapter-gated` · 노력 **M(중간)** · 🔴 차단 · tier:deferred

**왜**: ADR-0007에서 직접 지목된 SNS 중 Instagram은 "법인 Business Verification + Meta 앱심사" 게이트가 걸려 있고, cerebro의 사용 형태(제3자 공인/기업을 키워드로 임의 조회)는 Meta 심사에서 거절될 위험이 큰 항목이다. 코드 인프라(SourceAdapter 추상화, 'sns' SourceType, 웹 'SNS' 배지)는 이미 전부 갖춰져 있어 어댑터 자체는 파일 1개로 재도입 가능하나, 외부 승인 없이는 한 줄도 호출할 수 없다. 따라서 지금의 가치는 "구현"이 아니라 "보류 상태를 정확한 트리거/제약과 함께 추적"하는 데 있다. 무리한 선구현은 YAGNI·PIPA 위반 위험만 키운다. SNS 실시간 여론 커버리지 공백은 STATUS §6에 이미 수용된 한계로 기록돼 있어, 트래픽/승인 확보 전까지 보류가 합리적이다.

**수용 기준**:
- (지금 가능·검증) docs/adr/0007-social-community-sources.md와 docs/STATUS.md §6에 Instagram이 '보류' 상태이며 해제 트리거(Meta 법인 Business Verification + 앱심사 승인 확보)와 PIPA 제약(공인/비즈니스 공개 계정 한정, 비공개 계정·개인 민감정보 금지)이 명문으로 남아 있음 — grep으로 'Instagram' 항목과 트리거 문구 존재 확인. 누락 시 1~2줄 추가로 충족.
- (승인 후) apps/api/src/sources/instagram.ts가 SourceAdapter 인터페이스를 구현하고 requiresKey=true, isEnabled()는 토큰 env 미설정 시 false → registry.getEnabledAdapters()가 제외함을 instagram.test.ts(모킹 fetch)로 단정.
- (승인 후) 어댑터가 lib/http.ts safeFetch + allowHosts(graph.facebook.com)만 사용(직접 fetch 금지), rate-limit/withRetry 적용 — kakao.ts 패턴과 동일함을 코드 리뷰로 확인.
- (승인 후) PIPA 가드: Business Discovery 공개 필드(caption/permalink/media_url/timestamp/username)만 RawItem으로 매핑, 비공개 계정·개인 민감정보는 매핑하지 않음 — 단위 테스트가 비허용 필드 누락을 단정.
- (승인 후) CollectContext.query(키워드) → username 해석 경로가 정의되거나, 매핑 불가 시 빈 배열을 graceful 반환(스로우 금지) — 테스트가 'username 없음→[]' 케이스 커버.
- (승인 후) 출처 유형은 기존 'sns'(packages/shared/src/constants.ts) 재사용 → 계약 변경 없음, 웹 'SNS' 배지(apps/web/src/lib/sources.ts) 그대로 렌더.
- (승인 후) pnpm typecheck && pnpm test && pnpm lint && pnpm build 그린, 토큰 env를 root .env.example에 빈 플레이스홀더로 추가.

**건드릴 파일(예상)**: `/Users/kang/Desktop/cerebro/apps/api/src/sources/instagram.ts (신규 — 승인 후 생성, kakao.ts 패턴 복제)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/instagram.test.ts (신규 — kakao.test.ts 패턴, 모킹 fetch)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/kakao.ts (참조: 키 게이트 어댑터 표준 패턴)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/registry.ts (어댑터 등록 — 현재 wikipedia/naver/kakao)`, `/Users/kang/Desktop/cerebro/apps/api/src/sources/types.ts (SourceAdapter 인터페이스 — 변경 불요, 구현 기준)`, `/Users/kang/Desktop/cerebro/apps/api/src/env.ts (INSTAGRAM 토큰 optionalSecret 추가 위치)`, `/Users/kang/Desktop/cerebro/.env.example (빈 플레이스홀더 추가)`, `/Users/kang/Desktop/cerebro/packages/shared/src/constants.ts (SOURCE_TYPES에 'sns' 이미 존재 — 계약 변경 불요)`, `/Users/kang/Desktop/cerebro/apps/web/src/lib/sources.ts (sns→'SNS' 배지 이미 존재 — 변경 불요)`, `/Users/kang/Desktop/cerebro/apps/api/src/graph/category-rules.ts (instagram.com이 channel 도메인에 이미 포함 — 배지 분류 참조)`, `/Users/kang/Desktop/cerebro/docs/adr/0007-social-community-sources.md (보류 결정·트리거 기록처)`, `/Users/kang/Desktop/cerebro/docs/STATUS.md (§1 어댑터 표·§6 알려진 한계 갱신)`
**노력 근거**: 코드 구현만 보면 S~M: 어댑터는 kakao.ts(약 130줄)를 그대로 따르고 env/registry/.env.example 추가 + 모킹 테스트면 끝이며 인프라(safeFetch·rate-limit·cache·'sns' 타입·웹 배지)가 전부 준비돼 있다. M으로 잡는 이유는 (1) Business Discovery가 키워드 검색이 아니라 username 기반이라 query→username 해석 경로 설계가 필요하고, (2) 장기 토큰(60일) 갱신·만료 처리, (3) 공개 비즈니스 필드만 통과시키는 PIPA 매핑 가드가 추가되기 때문. 단, 실제 비용의 대부분은 코드가 아닌 '외부 승인'(법인 인증 서류·앱심사 제출·심사 대기, 수주~거절 가능)이며 이는 개발 effort 밖의 L급 비코드 작업이다.
**의존성**: 외부: Meta(Facebook) 법인 Business Verification 완료(사업자/법인 서류 필요); 외부: Instagram Graph API 앱 + Business Discovery 권한에 대한 Meta 앱심사(App Review) 승인 — 제3자 임의조회 use case는 거절 위험; 외부: 연결된 Facebook Page + Instagram 비즈니스/크리에이터 계정 + 장기 액세스 토큰; 내부: PIPA/법무 검토 — '공인·공개정보 한정' 정책이 제3자 비즈니스 계정 공개데이터 수집을 허용하는지 사인오프; 내부: SourceAdapter 인프라(registry/types/http/cache) — 이미 존재, 차단 아님
**리스크**: Meta 앱심사 거절(가장 큰 리스크): cerebro의 '제3자 공인/기업 임의조회'는 Meta가 명시적으로 막는 패턴 — 승인 자체가 불확실(ADR-0007 '거절 위험').; 제품 적합성: Business Discovery는 키워드 검색이 아니라 정확한 username 입력이 필요 → cerebro의 query 기반 수집 모델과 미스매치(검색 흐름에 username 해석 단계가 추가로 필요).; PIPA: 비공개 계정·개인 민감정보를 절대 수집하면 안 되며, 공인이라도 공개 비즈니스 필드로만 제한해야 함 — 매핑 가드 누락 시 정책 위반.; 운영 부담: Graph API 버전 잦은 변경·deprecation, 장기 토큰 60일 만료 갱신 필요 — 무상태 키 게이트 패턴보다 유지비 큼.; 오버엔지니어링: 승인 전 선구현 시 호출 불가한 죽은 코드만 남음(YAGNI). 보류 유지가 정답.
**비용**: Instagram Graph API 호출 자체는 무료(per-call 과금 없음)라 ADR-0005의 '무료·무카드' API 원칙엔 부합하나, 카드 대신 '법인 인증 서류 + 앱심사'라는 더 무거운 비금전 게이트가 있음. Anthropic 예산 $8.8에는 직접 영향 없음(LLM이 아닌 데이터 소스). 다만 소스가 늘면 ADR-0008 활용 리포트의 Claude 입력 토큰이 검색당 소폭 증가 — 단, 분석은 18건 상한·30분 캐시·키 게이트로 통제되므로 한계 비용은 미미. 결론: 지금 들이는 비용 0(보류 유지), 승인 확보 후에만 재검토.
**트리거(해제 조건)**: Meta 법인 Business Verification 완료 + Instagram Graph API Business Discovery 권한에 대한 앱심사 승인 확보, 그리고 PIPA/법무가 '제3자 공인 공개 비즈니스 계정' 수집을 사인오프할 때. 이 셋이 충족되기 전까지는 어댑터 파일을 만들지 않고 ADR-0007/STATUS §6 보류 상태로만 추적한다. (참고: SNS 무료·합법 1순위는 YouTube Data API v3 — Instagram보다 먼저 검토 권장, ADR-0007.)

