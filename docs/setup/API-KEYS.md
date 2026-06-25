# API 키 발급 가이드 (네이버 / 구글)

> cerebro의 키 필요 소스 어댑터를 켜기 위한 키 발급 방법.
> **키 값은 절대 커밋·공유 금지.** `apps/api/.env`(gitignore됨)에만 입력한다. ([SECURITY](../SECURITY.md))

## 0. 입력 위치
서버는 `apps/api/.env`를 읽는다(dev/start 시 cwd = `apps/api`). 다음 4개를 채운다.
```
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
GOOGLE_API_KEY=
GOOGLE_CSE_ID=
```
키가 비어 있으면 해당 어댑터는 자동 비활성(`isEnabled()=false`)이라 안전하다. 위키백과는 키 없이 항상 동작한다.

---

## 1. 네이버 검색 API (Client ID / Secret)

무료 · 일 25,000회 · 서버 헤더 인증(`X-Naver-Client-Id`, `X-Naver-Client-Secret`).

1. https://developers.naver.com 접속 → 네이버 계정 로그인.
2. 상단 **Application → 애플리케이션 등록**.
3. **애플리케이션 이름**: `cerebro` (자유).
4. **사용 API**: `검색` 선택.
5. **환경 추가**: `WEB 설정` 선택 → 웹 서비스 URL에 `http://localhost:5173` 입력(개발용. 검색 API는 비로그인 오픈 API라 콜백/도메인 검증이 느슨함. 배포 시 실제 도메인 추가).
6. **등록하기** → 내 애플리케이션 화면에서 **Client ID**, **Client Secret** 확인.
7. 두 값을 `.env`의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`에 입력.

- 사용 엔드포인트(예): `https://openapi.naver.com/v1/search/webkr.json?query=...`, `.../news.json`, `.../blog.json`, `.../local.json`.
- 쿼터 초과 시 429. cerebro는 캐시(30분) + rate limit으로 절약.

---

## 2. 구글 Programmable Search (API Key + 검색엔진 ID)

무료 100회/일(초과 시 유료). **API 키**와 **검색엔진 ID(cx)** 두 가지가 필요.

### 2-1. API 키 (`GOOGLE_API_KEY`)
1. https://console.cloud.google.com 접속 → 로그인.
2. 상단 프로젝트 드롭다운 → **새 프로젝트** → 이름 `cerebro` → **만들기** → 선택.
3. **Custom Search API 사용 설정**: https://console.cloud.google.com/apis/library/customsearch.googleapis.com → 프로젝트가 `cerebro`인지 확인 → **사용(Enable)**.
4. ☰ → **API 및 서비스 → 사용자 인증 정보** → **+ 사용자 인증 정보 만들기 → API 키** → 생성된 키 복사.
5. (권장) 키 ✏️ → **API 제한 → 키 제한 → Custom Search API** 선택 → 저장.
6. `.env`의 `GOOGLE_API_KEY=`에 입력. (결제 없이 100회/일 무료)

### 2-2. 검색엔진 ID (`GOOGLE_CSE_ID` = cx)
1. https://programmablesearchengine.google.com/controlpanel/all → **추가(Add)**.
2. 이름 `cerebro` → **"전체 웹 검색(Search the entire web)" 토글 켜기** → CAPTCHA → **만들기**.
3. 생성 후 **맞춤설정/개요**에서 **검색엔진 ID(Search engine ID)** 복사 → `.env`의 `GOOGLE_CSE_ID=`에 입력.

- ⚠️ JSON API는 **API 키 + 검색엔진 ID 둘 다** 필요(위젯 ID만으론 불가).
- 엔드포인트: `https://www.googleapis.com/customsearch/v1?key=<API_KEY>&cx=<CSE_ID>&q=<쿼리>&hl=ko`.
- 일 100회 무료 — 캐시(30분)로 절약, 필요 시 네이버 우선.

---

## 3. 입력 후
1. `apps/api/.env`에 4개 값 입력·저장.
2. 서버 재시작: `pnpm --filter @cerebro/api dev`.
3. 부팅 로그에 활성 어댑터 표시. 검색 시 네이버/구글 결과가 그래프에 합류한다.

## 보안 체크
- [ ] 키를 채팅·이슈·PR·로그에 붙여넣지 않았다.
- [ ] `apps/api/.env`는 `git status`에 안 보인다(gitignore).
- [ ] 노출 의심 시 해당 콘솔에서 즉시 키 재발급(회전).
