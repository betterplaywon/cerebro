# 🧠 cerebro

> 기업·개인(공개정보)의 흩어진 정보를 **3D 마인드맵**으로 한눈에 연결해 보여주는 인텔리전스 서비스.
> 영화 *X-Men* 의 'Cerebro'에서 영감을 받았습니다.

핵심 정보일수록 중앙에서 강조되고, 가지(branch)를 뻗어 관련 개념·출처를 구체(node)로 시각화합니다.
노드를 클릭하면 **정보의 출처와 활용 방법**을 담은 상세 패널이 열립니다.

---

## 🎯 제품 한 줄 정의

검색 키워드(기업명/브랜드/공개 인물)를 입력하면, 여러 공개 소스에서 수집·정제한 정보를
중심-가지 구조의 인터랙티브 3D 그래프로 탐색하는 웹 서비스.

## 🧱 기술 스택 (모노레포)

| 레이어 | 기술 |
|---|---|
| 모노레포 | pnpm workspaces |
| 프론트엔드 | Vite + React + TypeScript + React Three Fiber(Three.js) |
| 백엔드 | Node.js + Fastify + TypeScript |
| 공용 | `packages/shared` (타입/스키마/유틸 공유) |
| 데이터 | 하이브리드 수집 (공식 API 우선 + robots.txt 준수 공개 데이터) |
| 인프라(MVP) | 프론트=정적 호스팅 / API=무료 티어 / DB·Auth=Supabase (무료) |

## 📁 디렉토리 구조

```
cerebro/
├─ apps/
│  ├─ web/         # Vite + React + R3F 프론트엔드 (반응형 웹=웹+모바일)
│  └─ api/         # Node.js + Fastify 백엔드 (수집/정제/제공 API)
├─ packages/
│  └─ shared/      # 공용 타입·스키마·상수
├─ docs/           # PRD·아키텍처·데이터·보안·UX·GTM·QA 문서
├─ .claude/
│  ├─ agents/      # 8개 협업 에이전트 정의
│  ├─ rules/       # 개발 규칙(Rules)
│  └─ skills/      # 재사용 스킬
└─ .github/        # CI/CD, PR 템플릿
```

## 🤝 개발 방식 (Claude 에이전트 협업)

Frontend / Backend / Project Owner / UI·UX Designer / Orchestrator / Cyber Security / Marketer / QA
— 8개 에이전트가 협업하며 상호 고도화하고, 수시로 리팩토링합니다.
원칙: **클린 코드 · 안티패턴 회피 · 오버엔지니어링 경계 · 트레이드오프 고려.**

## 🔐 보안 원칙

- 개인정보·비밀키·시크릿은 **절대 커밋/공유 금지** (`.gitignore` + 시크릿 스캐닝).
- 개인 정보는 **공개정보/공인 한정**, 한국 PIPA(개인정보보호법) 가드레일 준수.
- 치명적 명령(`git reset`, `eval` 등) 사용 금지.

## 🌿 브랜치 / PR 운영

작업 단위 브랜치 → 세부 단위 커밋·푸시 → PR 생성 → 테스트 통과 시 머지.

## 🌐 국제화

MVP는 **한국어 전용**. 이후 영어·일본어 등 다국어로 확장(i18n 구조는 초기부터 반영).

---

자세한 내용은 [`docs/`](./docs) 와 [`docs/foundation/FOUNDATION-SPEC.md`](./docs/foundation/FOUNDATION-SPEC.md) 참고.
