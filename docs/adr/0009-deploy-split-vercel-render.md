# ADR-0009 — 배포 분리: 프론트=Vercel · 백엔드=Render (Supabase는 관리형 DB)

- 상태: Accepted
- 일자: 2026-06-26
- 관련: [DEPLOYMENT.md](../DEPLOYMENT.md)(운영 런북), [ADR-0008](./0008-llm-usage-report.md)(LLM 리포트 — 검색당 Claude 동기 호출)

## 맥락
M1 출시를 앞두고 배포처를 정해야 한다. 스택은 `apps/web`(Vite+R3F 정적 SPA), `apps/api`(Fastify 상시 프로세스), `packages/shared`(zod 계약), 관리형 Supabase다. api는 **인메모리 TTL+LRU 캐시**와 **인메모리 레이트리미터**를 무료 운영의 1차 방어선으로 쓴다(외부 쿼터·비용 절약). 두 장치 모두 *프로세스 메모리* 상태에 의존한다.

## 결정
- **web → Vercel**(정적 빌드), **api → Render Web Service**(상시 프로세스), **DB/Auth → Supabase**(관리형, 배포 대상 아님).
- Render는 레포 루트 `render.yaml` 블루프린트로 코드화(api 서비스 전용). 시크릿은 전부 `sync: false`(대시보드 입력).
- Vercel은 `vercel.json` 없이 대시보드 설정으로 구성(모노레포 자동 감지). Root Directory는 대시보드 전용 설정이라 파일로 못 박지 않고 `DEPLOYMENT.md`에 캡처.
- `apps/api`의 `tsx`를 devDependencies→**dependencies**로 이동(런타임 의존성 — start가 `tsx src/index.ts`). prod 설치에서도 보존되어 빌드 명령이 단순해짐.

## 대안
- **전부 Vercel(서버리스)**: 인메모리 캐시 적중률 붕괴(인스턴스 분산) + 레이트리미터 무력화(인스턴스별 `last=0`) + LLM 리포트 타임아웃 위험 + Fastify→serverless 어댑팅. → 무료 운영 설계와 정면 충돌, 기각.
- **전부 Render(web도 Static Site)**: 플랫폼 1개 이점은 있으나 web/api가 다른 오리진이라 **CORS·서비스 2개·URL 2개는 어차피 동일**. 절약은 "대시보드 하나"뿐이고, 시각 중심 프론트가 Vercel의 PR 프리뷰·엣지 이점을 잃음. 분리 대비 우위 작음.

## 트레이드오프
- **얻음**: api 인메모리 캐시·레이트리미터가 설계대로 작동(상시 프로세스). web은 Vercel PR 프리뷰·엣지 CDN·독립 배포 사이클.
- **비용**: 대시보드·env가 두 곳으로 분리. 프리뷰 배포는 단일 `CORS_ORIGIN`과 안 맞아 프로덕션 API 호출 차단(MVP 수용, 추후 origin 허용목록으로 확장 가능).
- **역가역성 높음**: web은 정적 SPA라 추후 Vercel→Cloudflare/Render 이전 비용 거의 0(재빌드+DNS). 조기 통합/분리 양방향 모두 저비용.
- **잔여 리스크**: Render 무료 플랜 spin-down(cold start + 캐시 초기화) — 데모엔 무해, 트래픽 증가 시 재검토.
