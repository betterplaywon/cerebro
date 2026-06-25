# Rule — 보안 (시크릿 / PIPA / 금지 명령)

> 근거·전체 맥락: [`FOUNDATION-SPEC §5`](../../docs/foundation/FOUNDATION-SPEC.md), [`docs/SECURITY.md`](../../docs/SECURITY.md). 이 파일은 **하드 룰**.

## 🔑 시크릿
- 키/토큰/비밀번호/private key는 **절대** 코드·문서·커밋 메시지·로그·PR·이슈에 평문 노출 금지.
- 보관: 로컬 `.env`(gitignore) / CI·호스팅의 시크릿 매니저. 공유는 안전 채널.
- `.env.example`에는 **빈 플레이스홀더만**(`NAVER_CLIENT_ID=`).
- 시크릿 스캐닝: pre-commit + CI(gitleaks). 누출 의심 → **즉시 키 회전** 후 이력 정리.

## 🧑‍⚖️ 개인정보 / PIPA
- 개인 대상은 **공개정보/공인 한정**. 비공개 개인의 신상 프로파일링 금지.
- **민감정보 수집·저장·표시 금지**: 주민번호·연락처·집주소·금융·건강·정치/종교/성적지향 등.
- 모든 개인 관련 노드는 **출처 + 수집근거 + 수집시각** 보존, 화면에 출처 표기.
- 삭제(잊힐 권리) 요청 대응 절차 유지.

## ⛔ 금지 명령/코드 (Hard Block — 자동화 포함)
- `git reset`(특히 `--hard`) · `git push --force`(보호 브랜치) · `git clean -fd`(검토 없이) · `git filter-branch`
- 광범위 `rm -rf` · fork bomb 류
- `eval(...)` · `new Function(...)` · 검증 없는 `child_process`/셸 실행
- 조건 없는 `DROP` / `DELETE` / `UPDATE`, 프로덕션 직접 파괴 쿼리
- 자격증명·시크릿 평문 출력/로깅

## 🛡️ 입력·수집 보안
- 모든 외부 입력 zod 검증. 출력 인코딩(XSS 방지).
- 데이터 수집 시 SSRF 방지: 대상 URL 스킴/호스트 화이트리스트·사설망 차단.
- robots.txt·ToS 준수. 인증벽 우회·과도한 크롤링 금지.
- CORS 화이트리스트, rate limit, 최소 권한 토큰.

## 점검
- [ ] `git diff`에 시크릿 없음  · [ ] `.env`만 사용  · [ ] 민감 개인정보 미수집  · [ ] 외부 입력 검증  · [ ] 금지 명령 미사용
