# CLAUDE.md — cerebro 작업 지침

> 이 파일은 매 세션 로드되는 **상시 규칙**입니다. 상세·근거는 [`docs/foundation/FOUNDATION-SPEC.md`](./docs/foundation/FOUNDATION-SPEC.md)(SSOT)를 따릅니다.

## 프로젝트 한 줄
cerebro = 기업·개인(공개정보)의 흩어진 정보를 수집·정제해 **중심-가지 구조 3D 마인드맵**으로 보여주는 웹 서비스. (X-Men 'Cerebro' 영감)

## 스택 (요약)
pnpm 모노레포 · 프론트 `apps/web`(Vite+React+TS+R3F) · 백엔드 `apps/api`(Node+Fastify+TS) · 공용 `packages/shared`(zod 계약) · DB/Auth `Supabase`. 한국어 MVP.

## 🔴 골든 룰 (반드시 준수)
1. **시크릿 금지**: 키/토큰/비밀번호/private key를 코드·문서·커밋·로그에 절대 노출 금지. `.env`(gitignore) + 호스팅 시크릿만. 누출 의심 → 즉시 회전.
2. **금지 명령**: `git reset`/`git push --force`(보호 브랜치)/`git clean -fd`(검토 없이)/`rm -rf` 광범위/`eval`·`new Function`/검증 없는 셸 실행/조건 없는 `DROP·DELETE·UPDATE`. → 절대 사용 금지. 상세: [`.claude/rules/security.md`](./.claude/rules/security.md)
3. **개인정보(PIPA)**: 개인은 **공개정보/공인 한정**, 민감정보 수집·저장·표시 금지, 출처·수집근거 보존, 삭제요청 대응.
4. **클린 코드 / 안티패턴 / 오버엔지니어링 경계 / 트레이드오프 명시**: [`.claude/rules/coding-standards.md`](./.claude/rules/coding-standards.md)
5. **Git 운영**: 작업 단위 브랜치 → 원자적 커밋 → 푸시 → PR → CI 통과 → 머지. 상세: [`.claude/rules/git-workflow.md`](./.claude/rules/git-workflow.md)
6. **사용자가 멈추라 하기 전까지 작업을 계속** 진행. 단, 되돌리기 어려운 외부 영향(배포·force push·삭제)은 확인 후.

## 🤝 에이전트 협업 (8)
Project Owner · Orchestrator · UI/UX Designer · Frontend · Backend · Cyber Security · QA · Marketer.
- 정의: [`.claude/agents/`](./.claude/agents/). 각자 영역의 1차 책임을 지되 협업·상호 리뷰·수시 리팩토링.
- 계약(타입/스키마)은 `packages/shared`에 먼저 합의 후 양측 구현.
- 타 영역 영향 변경은 PR에 명시 + 해당 에이전트 리뷰. 결정은 짧은 ADR(`docs/adr/`)로 기록.

## 작업 흐름 (기본)
1. 작업 시작 시 브랜치 생성(`<type>/<설명>`), 필요 시 ADR 작성.
2. `packages/shared` 계약 → 구현 → 테스트.
3. 커밋 전: 린트·타입체크·테스트·시크릿 스캔 통과 확인.
4. 푸시 → PR(템플릿 체크리스트) → CI 통과 → 리뷰 → squash 머지.

## 명령 (개발)
```bash
pnpm install            # 의존성 설치
pnpm dev                # 전체 개발 서버 (web + api)
pnpm --filter web dev   # 프론트만
pnpm --filter api dev   # 백엔드만
pnpm lint               # ESLint
pnpm typecheck          # tsc --noEmit
pnpm test               # Vitest
pnpm build              # 전체 빌드
```

## 문서 인덱스
PRD · ROADMAP · ARCHITECTURE · DATA-MODEL · DATA-SOURCING · SECURITY · UX-SPEC · DESIGN-SYSTEM · GTM · QA-STRATEGY → [`docs/`](./docs)
