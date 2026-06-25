---
name: start-task
description: cerebro에서 새 작업(기능/수정/문서)을 표준 절차로 시작할 때 사용. 작업 단위 브랜치 생성, 필요 시 ADR 작성, shared 계약 우선 합의, DoD 확인의 일관된 킥오프를 제공한다.
---

# start-task — 표준 작업 킥오프

cerebro의 모든 작업은 이 절차로 시작한다. ([git-workflow](../../rules/git-workflow.md) 준수)

## 1. 작업 정의
- 무엇을/왜: PO의 수용 기준(있다면)을 확인. 없으면 한 줄로 목표·완료 기준을 적는다.
- 영향 범위(web/api/shared/docs)와 관련 에이전트를 식별한다.

## 2. 브랜치 생성
```bash
git checkout main && git pull --ff-only
git checkout -b <type>/<짧은-설명>
```
- type: `feat` `fix` `chore` `docs` `refactor` `test` `perf` `ci` `security`
- ⚠️ 금지: `git reset`, `git push --force`(보호 브랜치), `git clean -fd`(검토 없이)

## 3. 계약 우선 (FE↔BE 영향 시)
- 타입/스키마를 `packages/shared`에 먼저 정의·합의한 뒤 양측 구현.

## 4. 트레이드오프가 있으면 ADR
- `docs/adr/NNNN-제목.md`에 5~15줄: 맥락 / 결정 / 대안 / 트레이드오프.

## 5. 구현 중 점검
- [ ] strict 타입, `any` 없음, 외부 입력 zod 검증
- [ ] 시크릿 하드코딩 없음(.env 사용)
- [ ] 불필요한 추상화/의존성 없음(YAGNI)
- [ ] 매직 넘버 상수화, 작은 함수/단일 책임

## 6. 커밋 (원자적, 자주)
```bash
pnpm lint && pnpm typecheck && pnpm test
git add -p
git commit
```
완료 후 → [pre-pr-check](../pre-pr-check/SKILL.md)로 PR 준비.
