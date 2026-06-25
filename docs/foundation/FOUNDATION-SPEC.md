# cerebro — Foundation Spec (SSOT)

> **이 문서는 단일 진실 공급원(Single Source of Truth)입니다.**
> 모든 에이전트·문서·코드는 이 스펙을 따릅니다. 충돌 시 이 문서가 우선합니다.
> 변경은 PR로만, Project Owner + 관련 에이전트 합의로 진행합니다.

- 문서 버전: `0.1.0`
- 최종 갱신: 2026-06-25
- 상태: **Living Document** (지속 갱신)

---

## 1. 제품 개요

**cerebro**는 기업·개인(공개정보)의 흩어진 정보를 수집·정제해 **중심-가지 구조의 인터랙티브 3D 마인드맵**으로 보여주는 웹 서비스다. 영화 *X-Men* 의 'Cerebro'에서 영감을 얻었다.

- **핵심 가치**: 흩어진 공개 정보 → 한눈에 연결된 지식 그래프.
- **핵심 인터랙션**: 키워드 검색 → 로딩(세레브로 연출) → 3D 그래프 탐색 → 노드 클릭 → 출처·활용법 상세 패널.
- **타깃(MVP)**: 기업/브랜드 + 공개 인물(공인). 개인은 **공개정보 한정**.

### 1.1 확정 결정 (Kickoff)

| 항목 | 결정 | 비고 |
|---|---|---|
| 대상 범위 | 기업 + 개인 둘 다 | 개인은 공개정보/공인 한정, PIPA 가드레일 필수 |
| 데이터 수집 | 하이브리드 | 공식 API 우선 + robots.txt 준수 공개 데이터 |
| 첫 산출물 | 기반·체계 우선 | 에이전트/룰/문서/스캐폴딩/CI |
| 기술 스택 | Vite + Node.js 모노레포 | Next.js 미사용, pnpm workspaces |
| 언어 | 한국어 전용(MVP) | i18n 구조는 초기부터, 추후 en/ja |
| 호스팅(MVP) | 무료 티어 | 유저 확보 후 단계적 확장 |

---

## 2. 기술 스택 & 버전 정책

| 레이어 | 기술 | 버전 정책 |
|---|---|---|
| 런타임 | Node.js | `>=22` (현 LTS 22.x) |
| 패키지 매니저 | pnpm | `>=10` (workspaces) |
| 언어 | TypeScript | `^5` (strict 모드 필수) |
| 프론트 빌드 | Vite | 최신 메이저 |
| 프론트 UI | React | `^18+` |
| 3D | three / @react-three/fiber / @react-three/drei | 최신 안정 |
| 상태관리 | Zustand | 가벼운 전역 상태 (오버엔지니어링 회피) |
| 데이터 패칭 | TanStack Query | 서버 상태 캐시 |
| 백엔드 | Fastify | `^5` |
| 검증 | Zod | 프론트·백엔드 공용 스키마 |
| 테스트 | Vitest (+ Testing Library, Playwright는 추후) | |
| 린트/포맷 | ESLint(flat config) + Prettier | |
| DB/Auth(MVP) | Supabase (Postgres) | 무료 티어 |

> **버전 픽스 원칙**: package.json은 caret(`^`) 범위로 작성하고 `pnpm-lock.yaml`로 핀 고정. 정확한 설치 버전은 lockfile이 진실. 의존성 추가는 "정말 필요한가?"를 먼저 묻는다(오버엔지니어링 경계).

---

## 3. 모노레포 레이아웃 & 디렉토리 소유권

```
cerebro/
├─ apps/
│  ├─ web/                 # [Frontend] Vite + React + R3F
│  └─ api/                 # [Backend] Node.js + Fastify
├─ packages/
│  └─ shared/              # [FE+BE] 공용 타입/스키마(zod)/상수
├─ docs/                   # [PO/Architect 등] 문서
│  └─ foundation/          # 이 스펙 등 기반 문서
├─ .claude/
│  ├─ agents/              # 8개 에이전트 정의
│  ├─ rules/               # 개발 규칙
│  └─ skills/              # 재사용 스킬
└─ .github/                # CI/CD, 템플릿
```

### 3.1 파일 소유권 맵 (병렬 작업 충돌 방지)

| 경로 | 1차 책임 에이전트 |
|---|---|
| `apps/web/**` | Frontend Engineer (+ UI/UX Designer) |
| `apps/api/**` | Backend Engineer |
| `packages/shared/**` | Backend + Frontend (계약) |
| `docs/PRD.md`, `docs/ROADMAP.md` | Project Owner |
| `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md` | Orchestrator/Architect |
| `docs/DATA-SOURCING.md` | Backend Engineer |
| `docs/SECURITY.md` | Cyber Security |
| `docs/UX-SPEC.md`, `docs/DESIGN-SYSTEM.md` | UI/UX Designer |
| `docs/GTM.md` | Marketer |
| `docs/QA-STRATEGY.md` | QA |
| `.claude/**`, `.github/**` | Orchestrator |

---

## 4. 코딩 표준 (클린 코드 · 안티패턴 · 트레이드오프)

### 4.1 원칙
1. **클린 코드**: 의미 있는 이름, 작은 함수, 단일 책임, 명시적 의존성. 주석은 "왜"를 설명(무엇/어떻게는 코드로).
2. **안티패턴 회피**: God object, 순환 의존, 깊은 상속, 매직 넘버, 전역 가변 상태, 죽은 코드, 조기 추상화 금지.
3. **오버엔지니어링 경계**: YAGNI. 추상화는 **3번째 중복**에서. 라이브러리 추가 전 표준/내장으로 가능한지 확인.
4. **트레이드오프 명시**: 결정은 `docs/adr/`(Architecture Decision Record)에 짧게 기록(대안·근거·트레이드오프).
5. **타입 안전**: `any` 금지(불가피하면 `unknown`+가드). strict 모드. 경계(API/입력)는 zod 런타임 검증.
6. **에러 처리**: 삼키지 않기. 사용자向 메시지/로그 분리. API는 일관된 에러 스키마.

### 4.2 네이밍 컨벤션
| 대상 | 규칙 | 예 |
|---|---|---|
| 파일(컴포넌트) | PascalCase | `MindMapCanvas.tsx` |
| 파일(그 외 ts) | kebab-case | `graph-layout.ts` |
| 변수/함수 | camelCase | `fetchNodes` |
| 타입/인터페이스 | PascalCase | `GraphNode` |
| 상수 | UPPER_SNAKE | `MAX_NODES` |
| zod 스키마 | `XxxSchema` | `NodeSchema` |
| 디렉토리 | kebab-case | `data-sources/` |

### 4.3 함수/모듈 가이드
- 함수 길이 가이드 ~40줄, 인자 ≤4(초과 시 객체). 순환 복잡도 과도하면 분리.
- 부수효과 격리(순수 함수 우선). I/O는 경계 레이어로.

---

## 5. 보안 규칙 (필수 준수)

1. **시크릿 절대 커밋 금지**: API 키/토큰/비밀번호/private key는 `.env`(gitignore)와 호스팅 시크릿 매니저로만. 코드/문서/커밋 메시지에 노출 금지.
2. **시크릿 스캐닝**: pre-commit + CI에서 gitleaks. 누출 의심 시 즉시 키 회전.
3. **개인정보(PIPA)**: 개인은 **공개정보/공인 한정**. 민감정보(주민번호·연락처·주소·건강·정치성향 등) 수집/저장/표시 금지. 출처·수집근거 표기. 삭제 요청 절차 마련.
4. **입력 검증**: 모든 외부 입력 zod 검증. SQL/명령 인젝션·SSRF·XSS 방지. 출력 인코딩.
5. **최소 권한**: 토큰/DB 권한 최소화. CORS 화이트리스트. rate limit.
6. **의존성**: `pnpm audit`/Dependabot. 신뢰 가능한 패키지만.

### 5.1 금지 명령/코드 (Hard Block)
> 아래는 **절대 사용 금지**. 자동화/스크립트/에이전트 모두 적용.

- `git reset`(특히 `--hard`), `git push --force`(보호 브랜치), `git clean -fd`(검토 없이)
- `eval`, `new Function(...)`, `child_process` 임의 셸 실행(검증 없는 입력)
- `rm -rf` 광범위 삭제, `:(){ :|:& };:` 등 fork bomb
- 자격증명/시크릿 평문 출력(로그 포함)
- 프로덕션 DB 직접 파괴적 쿼리(`DROP`, 조건 없는 `DELETE/UPDATE`)

---

## 6. Git / 브랜치 / 커밋 / PR 운영

### 6.1 브랜치 전략 (trunk-based 경량)
- 기본 브랜치: `main` (항상 배포 가능 상태 유지).
- 작업 브랜치: `<type>/<짧은-설명>` — 작업 단위로 생성.
  - type: `feat` `fix` `chore` `docs` `refactor` `test` `perf` `ci` `security`
  - 예: `feat/3d-mindmap-canvas`, `docs/data-sourcing-strategy`
- 직접 `main` 푸시 금지(부트스트랩 제외). PR 경유.

### 6.2 커밋 컨벤션 (Conventional Commits)
```
<type>(<scope>): <요약, 한국어 가능, 명령형>

<본문: 무엇을/왜 — 선택>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
- **세부 내역 단위**로 잦게 커밋(원자적). 빌드/테스트 통과 상태로 커밋.
- scope 예: `web`, `api`, `shared`, `docs`, `ci`, `agents`.

### 6.3 PR 운영
- 작업 완료 → 푸시 → **PR 생성** → CI(lint/typecheck/test/build) 통과 → 리뷰 → 머지.
- PR 템플릿 체크리스트 준수(테스트·보안·문서·트레이드오프).
- 머지 방식: squash (히스토리 간결). 머지 후 작업 브랜치 삭제.
- PR 본문 푸터: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

---

## 7. 에이전트 협업 모델 (8 Agents)

| 에이전트 | 역할 요약 |
|---|---|
| **Project Owner** | 비전/우선순위/스코프/수용기준. 백로그·로드맵 관리. |
| **Orchestrator** | 작업 분해/조율, 에이전트 간 인터페이스·일관성, 리팩토링 주도. |
| **UI/UX Designer** | 세레브로 비주얼·로딩 연출·3D 인터랙션·디자인 시스템·접근성. |
| **Frontend Engineer** | `apps/web` 구현(React+R3F), 성능/반응형. |
| **Backend Engineer** | `apps/api` 구현, 하이브리드 데이터 수집/정제/제공. |
| **Cyber Security** | 시크릿/PIPA/취약점/위협모델/리뷰 게이트. |
| **QA** | 테스트 전략·자동화·회귀·수용기준 검증. |
| **Marketer** | GTM·포지셔닝·BM 확장(무료→유료) 전략. |

### 7.1 협업 규칙
- 모든 에이전트는 이 스펙과 `.claude/rules/*`를 준수.
- 계약(타입/스키마)은 `packages/shared`에 선반영 후 양측 구현.
- 변경이 타 에이전트 영역에 영향 시 PR 설명에 명시 + 해당 에이전트 리뷰.
- **수시 리팩토링**: 보이스카웃 규칙(만진 코드는 더 깨끗하게). 단, 스코프 폭주 금지.
- 의사결정은 짧은 ADR로 남긴다.

---

## 8. 데이터 수집 정책 (하이브리드) — 요약

> 상세는 `docs/DATA-SOURCING.md`.

- **공식 API 우선**: 네이버 검색/지역, 구글 Programmable Search, 앱스토어/플레이스토어 공개 API, 공공데이터 등. ToS·쿼터 준수.
- **공개 데이터(보강)**: robots.txt·ToS 준수 범위에서만. 과도한 크롤링·우회·인증벽 통과 금지.
- **정제/출처**: 모든 노드는 **출처(source) + 수집시각 + 신뢰도**를 보존. 사용자에게 출처·활용법 표시.
- **PIPA**: 개인 대상은 공개정보 한정, 민감정보 제외, 삭제요청 대응.
- **캐시**: 수집 결과 캐시로 쿼터 절약·속도 확보(무료 운영 핵심).

---

## 9. 비기능 요구 (NFR) 가이드

- **반응형**: 모바일~데스크톱 단일 웹앱. 모바일 저사양 시 3D 품질 자동 저하(노드 수/효과 축소) 폴백.
- **성능 예산(초기 목표)**: 초기 로드 의미 있는 콘텐츠 < 3s(중급 모바일), 3D 인터랙션 ~60fps 지향(대형 그래프는 LOD/인스턴싱).
- **접근성**: 키보드 탐색·명도 대비·모션 민감(prefers-reduced-motion) 대응.
- **관측성**: 구조적 로깅, 에러 트래킹(무료 티어), 기본 분석.
- **비용**: MVP 무료 티어 내. 캐싱·쿼터·콜드스타트 트레이드오프 문서화.

---

## 10. 용어 (Glossary)

- **Node(노드/구체)**: 그래프의 정보 단위(엔터티/개념/출처).
- **Edge(가지)**: 노드 간 관계.
- **Center(중심)**: 검색 주제(가장 강조).
- **Source**: 정보 출처(API/사이트/문서).
- **Cerebro Loading**: 회색 인간 형상들이 스쳐가는 X맨식 로딩 연출.
