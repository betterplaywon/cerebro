# Rule — Git / 브랜치 / 커밋 / PR

> 근거: [`FOUNDATION-SPEC §6`](../../docs/foundation/FOUNDATION-SPEC.md). 이 파일은 **운영 체크리스트**.

## 브랜치
- 기본 `main`은 항상 배포 가능. 직접 푸시 금지(부트스트랩 제외).
- 작업 단위 브랜치: `<type>/<짧은-설명>` (kebab-case).
  - type: `feat` `fix` `chore` `docs` `refactor` `test` `perf` `ci` `security`
  - 예: `feat/3d-mindmap-canvas`, `feat/naver-source-adapter`

## 커밋 (Conventional Commits, 원자적)
```
<type>(<scope>): <명령형 요약>

<본문: 무엇을/왜 — 선택>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
- scope: `web` `api` `shared` `docs` `ci` `agents` 등.
- **세부 단위로 자주** 커밋. 각 커밋은 빌드/테스트 통과 상태.
- 절대 `git reset`/`git push --force`로 히스토리 파괴 금지.

## PR
1. 푸시 → `gh pr create` (PR 템플릿 체크리스트 작성).
2. CI(lint·typecheck·test·build·시크릿스캔) **통과 필수**.
3. 관련 에이전트 리뷰 → 승인.
4. **squash 머지** → 작업 브랜치 삭제.
5. PR 본문 푸터: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## DoD (머지 전)
- [ ] 수용 기준 충족  · [ ] 테스트 추가/통과  · [ ] 린트·타입체크 통과
- [ ] 시크릿 없음  · [ ] 문서/ADR 갱신  · [ ] 트레이드오프 기록  · [ ] 타 영역 영향 명시
