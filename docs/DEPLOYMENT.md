# DEPLOYMENT — 배포 가이드 (web→Vercel · api→Render)

> 결정 근거: [`ADR-0009`](./adr/0009-deploy-split-vercel-render.md). 이 문서는 **운영 런북**.
> 🔴 골든룰 1(시크릿 비노출)이 최우선 — 아래 "보안 철칙"을 먼저 읽으세요.

## 토폴로지
| 대상 | 호스트 | 형태 | 비고 |
|---|---|---|---|
| `apps/web` | **Vercel** | 정적 빌드(SPA) | Vite 번들을 CDN이 서빙. 실행 프로세스 없음 |
| `apps/api` | **Render** | Web Service(상시 프로세스) | Fastify. 인메모리 캐시·레이트리미터가 설계대로 작동 |
| DB/Auth | **Supabase** | 관리형 | 배포 대상 아님 — 어디에 올리든 Supabase 인프라에 상주 |

## 🔑 보안 철칙 (먼저)
1. **시크릿은 절대 레포에 없습니다.** `render.yaml`의 모든 시크릿은 `sync: false`(값 없음) → 값은 **Render 대시보드에서만** 입력. 리터럴 `value:`에 시크릿 금지.
2. **`VITE_*`는 전부 공개값입니다.** Vite가 빌드 시 클라이언트 번들에 그대로 인라인 → **진짜 시크릿에 `VITE_` 접두사 금지.** (Supabase **anon** 키는 RLS로 보호되는 공개키라 예외적으로 허용.)
3. **`SUPABASE_SERVICE_ROLE_KEY` 등 서버 전용 시크릿은 Render(api)에만.** 절대 Vercel(web)·`VITE_`로 넘기지 않음.
4. 로컬 `apps/api/.env`는 gitignore되어 있으나 실재함 → **`git add -f` 금지.** 커밋 전 `git diff`에 시크릿 없음 확인(CI gitleaks가 2차 차단).

---

## A. Render — API 배포

레포 루트 [`render.yaml`](../render.yaml) 블루프린트로 배포합니다.

1. Render 대시보드 → **New → Blueprint** → 이 레포 연결 → `render.yaml` 자동 감지.
2. 최초 동기화 시 **`sync: false` 값 입력 프롬프트**가 뜹니다. 아래를 대시보드에 입력:
   - **시크릿**: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `ANTHROPIC_API_KEY` *(Supabase 연동 시 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY` 추가)*
   - **`CORS_ORIGIN`**(비시크릿): web이 아직 없으니 임시값 입력 후 §C.3에서 실제 web 오리진으로 갱신. `sync:false`라 이후 resync에도 값 보존.
3. 자동 적용되는 것(코드 변경 불필요): `$PORT` 주입(앱이 `process.env.PORT` 읽음·`host 0.0.0.0` 바인딩), `GET /health` 헬스체크.
4. 배포 후 발급된 **API URL**(예: `https://cerebro-api.onrender.com`)을 메모 → B단계에서 사용.

**무료 플랜 주의**: ~15분 idle 후 spin-down → 첫 요청 cold start(수십 초) + 인메모리 캐시 초기화. 데모/저트래픽 OK. 상시 워밍 필요 시 유료 Starter.

## B. Vercel — Web 배포

`vercel.json`은 **불필요**합니다(모노레포 자동 감지). 대시보드 **Project Settings**에 아래 값을 설정:

| 항목 | 값 |
|---|---|
| **Root Directory** | `apps/web` (+ "Include files outside Root Directory" 토글 ON — pnpm 워크스페이스 자동 활성) |
| Framework Preset | Vite (자동 감지) |
| Build Command | `pnpm --filter @cerebro/web build` |
| Output Directory | `dist` (Root 기준 상대경로 = `apps/web/dist`) |
| Install Command | *(기본 유지 — Vercel이 워크스페이스 인식 install 수행)* |

**환경변수**(Settings → Environment Variables, 빌드 타임 인라인이므로 빌드 전 설정):
- `VITE_API_BASE_URL` = A단계 Render API의 **오리진만**(예: `https://cerebro-api.onrender.com` — 끝 슬래시·경로 없이. 클라이언트가 `/api/search`를 덧붙임) *(Production)*
- *(Supabase 연동 시)* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **공개값임**(번들에 노출). anon 키만 허용.

## C. 연결 순서 (닭-달걀 해소)
1. **A. Render(api) 먼저 배포** → API URL 확보.
2. **B. Vercel(web)**: `VITE_API_BASE_URL`에 API URL 입력 후 배포 → web URL 확보.
3. **A로 복귀**: Render 대시보드에서 **`CORS_ORIGIN`을 실제 web 오리진으로 갱신**(끝 슬래시·와일드카드 없이). `CORS_ORIGIN`은 `sync:false`라 대시보드 값이 Blueprint resync에도 보존됨(리터럴 `value:`였다면 resync 시 되돌아가 CORS가 깨짐 — 그래서 sync:false).

## D. 프리뷰 배포 CORS 주의
Vercel 프리뷰는 매번 다른 `*.vercel.app` URL을 받습니다. API의 CORS는 `origin: env.CORS_ORIGIN` **단일 문자열**이라 프리뷰 오리진은 차단됩니다.
- **현재(MVP)**: 프리뷰는 UI 확인용, 데이터 호출은 프로덕션에서 검증 → 그대로 OK.
- **확장 시**: `CORS_ORIGIN`을 리스트/정규식(`/\.vercel\.app$/`)으로 받도록 api 변경(shared 계약 영향 — Backend 합의 후).

## E. 후속 하드닝 (선택, 별도 작업)
- 로컬 **pre-commit gitleaks** 훅 추가 — 현재 시크릿 스캔은 CI(push 후)에만 존재. 좌측 차단(shift-left)용.
- api **JS 컴파일 후 `node` 실행**(현재 cold start마다 tsx 트랜스파일) — STATUS의 "다음 단계=최적화"와 정합.
