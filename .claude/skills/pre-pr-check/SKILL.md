---
name: pre-pr-check
description: cerebro에서 PR을 올리기 전 품질·보안·DoD를 검증하고 PR을 생성할 때 사용. 린트/타입체크/테스트/빌드/시크릿스캔을 돌리고 체크리스트를 확인한 뒤 gh로 PR을 만든다.
---

# pre-pr-check — PR 전 검증 & 생성

## 1. 로컬 게이트 (모두 통과해야 함)
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 2. 시크릿 스캔
```bash
git diff --staged        # 눈으로 시크릿/키 확인
# gitleaks 설치 시:
gitleaks protect --staged --no-banner || echo "⚠️ 시크릿 의심 — 커밋 중단"
```

## 3. DoD 체크리스트
- [ ] 수용 기준 충족 · 신규/변경 로직에 테스트
- [ ] 린트·타입체크·테스트·빌드 그린
- [ ] 시크릿/민감 개인정보 없음 (PIPA 준수)
- [ ] 금지 명령/코드 미사용
- [ ] 문서/ADR 갱신, 트레이드오프 기록
- [ ] 타 에이전트 영역 영향 명시

## 4. 푸시 & PR
```bash
git push -u origin <branch>
gh pr create --fill --base main
```
PR 본문에 포함: 변경 요약 · 테스트 방법 · 영향 영역 · 체크리스트.
푸터: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## 5. 머지 (CI 통과 + 리뷰 후)
```bash
gh pr merge --squash --delete-branch
```
⚠️ force push·history 파괴 금지. CI 레드 상태로 머지 금지.
