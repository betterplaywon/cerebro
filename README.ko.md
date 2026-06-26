# 🧠 cerebro

[English](./README.md) · **한국어**

> 기업·브랜드·공개 인물의 흩어진 정보를 수집·정제해 **중심-가지 구조의 인터랙티브 3D 마인드맵**으로 보여주는 인텔리전스 웹 서비스.
> 영화 *X-Men* 의 'Cerebro'에서 영감을 받았습니다.

검색어를 입력하면 여러 공개 소스에서 정보를 모아 정제하고, 핵심일수록 중앙에서 강조되는 3D 그래프로 시각화합니다.
노드를 클릭하면 **요약·활용 관점 리포트·출처**를 담은 상세 패널이 열립니다.

---

## ✅ 현재 상태 (M1 — 하이브리드 검색 라이브)

핵심 루프가 **엔드투엔드로 동작**합니다: `검색 → 세레브로 로딩 → 3D 마인드맵 → 노드 상세(요약·활용 리포트·출처)`.

- **하이브리드 수집**: `POST /api/search` 가 **위키백과 + 네이버(+카카오)** 의 실제 공개정보를 병렬 수집(일부 실패 허용)·정제해 중심-가지 그래프로 반환. 외부 응답은 zod 런타임 검증, 캐시(30분)·빈약 시 mock 폴백.
- **LLM 활용 관점 리포트** (ADR-0008): `ANTHROPIC_API_KEY` 설정 시 검색당 1회 Claude(Sonnet 4.6) 호출 → 중심 노드=핵심 요약, 자식 `usage` 노드=관점별(투자/취업/경제/사회/건강 등 해당 항목만) 활용법. **키 없으면 휴리스틱(카테고리/토픽) 그래프로 자동 폴백(지출 0)**.
- **출처 투명성**: 그래프 하단 "분석된 출처 N건" + 유형별 한글 배지(네이버·위키백과·카카오), 상세 패널에 출처 표기.
- **시네마틱 3D 마인드맵** (PR #22): R3F + postprocessing(Bloom), 글래스 아이콘 타일·라벨·클릭 포커스.
- **공유 가능한 딥링크**: 검색어의 진실원(source of truth)이 URL(`?q=`) — 결과 페이지를 그대로 공유·새로고침 가능.
- **품질 게이트 그린**: 23개 테스트 파일·229 케이스(API 206 + Web 23), lint·typecheck·build 통과.

> 📋 어디까지 했고 다음에 뭘 할지는 **[`docs/STATUS.md`](./docs/STATUS.md)** (작업 재개 시 먼저 읽기) · 백로그는 **[`docs/BACKLOG.md`](./docs/BACKLOG.md)**.

## 🔌 데이터 소스 상태

| 소스 | 상태 | 비고 |
|---|---|---|
| 위키백과 | ✅ 동작 | 키 불필요 (ko.wikipedia REST) |
| 네이버 검색 | ✅ 동작 | webkr·news·blog·cafe·kin (단일 키, 일일 25k콜 공유) |
| 카카오(다음) 검색 | ⏸️ 키 대기 | web·blog·cafe — 국내 커뮤니티 보완. `KAKAO_REST_API_KEY` 입력 시 자동 활성 (ADR-0007) |
| 광범위 웹검색 | ⏸️ 보류 | 구글=신규 영구차단·Brave=2026-02 무료폐지. 재도입 1순위 Tavily (ADR-0005) |
| SNS (X·인스타·페북) | ⏸️ 보류 | 유료·법인심사·공개검색 API 부재 (ADR-0007) |

## 🧱 기술 스택 (pnpm 모노레포)

| 레이어 | 기술 |
|---|---|
| 모노레포 | pnpm workspaces (Node ≥22, pnpm ≥10) |
| 프론트엔드 | Vite 6 · React 18 · TypeScript · React Three Fiber + drei + postprocessing(Three.js) |
| 데이터 페칭 | TanStack Query (query-factory 패턴) · 테스트는 MSW 모킹 |
| 백엔드 | Node.js · Fastify 5 · TypeScript · zod |
| LLM 분석 | `@anthropic-ai/sdk` (Claude Sonnet 4.6, 키 게이트·폴백) |
| 공용 | `packages/shared` — zod 계약 SSOT (Graph/Source/Search 스키마) |
| 인프라(MVP) | 프론트=정적 호스팅 / API=무료 티어 / DB·Auth=Supabase (M2 예정) |

## 📁 디렉토리 구조

```
cerebro/
├─ apps/
│  ├─ web/                    # Vite + React + R3F 프론트엔드 (반응형=웹+모바일)
│  │  └─ src/
│  │     ├─ components/       # SearchBar · CerebroLoader · MindMapView · MindMapCanvas · DetailPanel · SourceSummary …
│  │     ├─ hooks/            # useCerebroSearch · useUrlSearchParam (URL=검색어 진실원)
│  │     ├─ queries/          # TanStack Query query-factory (search)
│  │     ├─ api/client.ts     # /api/search 클라이언트
│  │     └─ lib/              # layout · colors · sources · queryClient
│  └─ api/                    # Node.js + Fastify 백엔드
│     └─ src/
│        ├─ server.ts         # POST /api/search · GET /health (transport만, 로직은 위임)
│        ├─ search/           # search-orchestrator (검증·캐시·폴백·계약보증)
│        ├─ sources/          # SourceAdapter: wikipedia · naver · kakao · registry · example
│        ├─ collect/          # normalize · dedup · score(토픽) · pii(민감정보 마스킹) · orchestrator
│        ├─ analyze/report.ts # LLM 활용 관점 분석 (Claude, 키 게이트·PIPA 가드)
│        ├─ graph/build.ts    # 수집 → GraphSnapshot (전략 디스패처: 분석/카테고리/토픽)
│        ├─ lib/              # http(SSRF-safe) · cache(TTL+LRU) · rate-limit · text
│        └─ env.ts            # zod 환경검증 (옵셔널 키=빈값→비활성)
├─ packages/
│  └─ shared/                 # 공용 zod 계약·상수 (계약 변경은 여기 먼저)
├─ docs/                      # STATUS · BACKLOG · PRD · ARCHITECTURE · ADR …
├─ .claude/
│  ├─ agents/                 # 8개 협업 에이전트 정의
│  ├─ rules/                  # 개발 규칙 (security · coding-standards · git-workflow)
│  └─ skills/                 # 재사용 스킬 (pre-pr-check · start-task)
└─ .github/                   # CI/CD, PR 템플릿
```

> **새 소스 추가법**: `sources/` 에 `SourceAdapter` 구현 + `registry.ts` 등록 → SSRF·캐시·폴백 자동 상속. 키 필요 시 `isEnabled()` 로 게이트.

## 🚀 로컬 실행

```bash
pnpm install
pnpm dev                # web :5173 + api :8787 (병렬)

# 또는 개별 실행
pnpm --filter web dev
pnpm --filter api dev

# 전체 품질 게이트 (현재 그린)
pnpm typecheck && pnpm test && pnpm lint && pnpm build
```

API 단독 확인:

```bash
curl -s localhost:8787/api/search -X POST \
  -H 'content-type: application/json' \
  -d '{"query":"토스"}'
```

### 환경변수

`.env.example` 을 복사해 `apps/api/.env`(서버 전용) / `apps/web/.env`(`VITE_` 만 노출)로 사용합니다.

| 키 | 필수 | 용도 |
|---|---|---|
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 권장 | 네이버 검색 API (미설정 시 위키만으로 동작) |
| `KAKAO_REST_API_KEY` | 선택 | 카카오 검색 (국내 커뮤니티 보완, 미설정 시 비활성) |
| `ANTHROPIC_API_KEY` | 선택 | LLM 활용 리포트 (미설정 시 휴리스틱 폴백, 지출 0) |
| `ANALYSIS_MODEL` | 선택 | 분석 모델 오버라이드 (기본 `claude-sonnet-4-6`) |

> 🔑 키/토큰/비밀번호는 **절대** 코드·문서·커밋·로그에 노출 금지. `.env` 는 gitignore 되어 있으며, 누출 의심 시 즉시 회전합니다.
> 💸 LLM 리포트 비용: 검색당 1회 호출(~$0.03–0.05), 캐시 재요청은 0. 지출 차단이 필요하면 `.env` 에서 `ANTHROPIC_API_KEY` 를 제거하면 자동으로 휴리스틱 폴백(0원).

## 🤝 개발 방식 (Claude 에이전트 협업)

Frontend / Backend / Project Owner / UI·UX Designer / Orchestrator / Cyber Security / Marketer / QA
— 8개 에이전트가 협업하며 상호 리뷰·수시 리팩토링합니다. 계약(타입/스키마)은 `packages/shared` 에 먼저 합의 후 양측 구현하고, 트레이드오프 결정은 짧은 ADR(`docs/adr/`)로 기록합니다.
원칙: **클린 코드 · 안티패턴 회피 · 오버엔지니어링 경계 · 트레이드오프 명시.**

## 🔐 보안 / 개인정보 (PIPA)

- 개인정보·비밀키·시크릿은 **절대 커밋/공유 금지** (`.gitignore` + 시크릿 스캐닝).
- 개인 정보는 **공개정보/공인 한정**, 한국 PIPA 가드레일 준수. 주민번호·연락처 등 민감정보는 수집 경계(`collect/pii.ts`)에서 마스킹.
- 데이터 수집 시 SSRF 방지(URL 스킴/호스트 화이트리스트·사설망 차단), robots.txt·ToS 준수.
- 치명적 명령(`git reset`, `git push --force`, `eval`, 조건 없는 DROP 등) 사용 금지.

상세: [`.claude/rules/security.md`](./.claude/rules/security.md) · [`docs/SECURITY.md`](./docs/SECURITY.md)

## 🌿 브랜치 / PR 운영

작업 단위 브랜치(`<type>/<설명>`) → 원자적 커밋·푸시 → PR(템플릿 체크리스트) → CI(lint·typecheck·test·build·시크릿스캔) 통과 → 리뷰 → **squash 머지 + 브랜치 삭제**.
상세: [`.claude/rules/git-workflow.md`](./.claude/rules/git-workflow.md)

## 🌐 국제화

MVP는 **한국어 전용**. 이후 영어·일본어 등 다국어로 확장(i18n 구조는 초기부터 고려).

---

📚 더 보기: [`docs/STATUS.md`](./docs/STATUS.md)(현재 상태·재개 가이드) · [`docs/`](./docs)(PRD·아키텍처·데이터·보안·UX·GTM·QA) · [`docs/foundation/FOUNDATION-SPEC.md`](./docs/foundation/FOUNDATION-SPEC.md)(SSOT) · [`docs/adr/`](./docs/adr)(결정 기록)
