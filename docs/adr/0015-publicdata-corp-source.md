# ADR-0015 — 공공데이터포털(금융위 기업기본정보) Layer B 소스 도입

- 상태: Accepted (구현 머지 · 키 발급 후 라이브 검증 1건 잔존)
- 일자: 2026-06-28
- 보완 대상: [ADR-0014](./0014-source-license-segmentation.md)(소스 라이선스 분리)의 명시된 트레이드오프 "(−) 무료 LLM 리포트의 한국어/시의성 깊이 약화"의 첫 번째 해소 조치.

## 맥락
ADR-0014(LAYER-SPLIT)로 네이버·카카오를 **Layer A(표시 전용)**로 분리하면서 LLM 활용 리포트 입력을 **Layer B(상업 OK)** 로 제한했다(`report.ts`의 `items.filter(i=>i.layer==='B')`). 그런데 무료 Layer B 소스는 사실상 **위키백과뿐**이라, 배포 환경에서 리포트 입력이 위키 ≤8건으로 얇아지고 위키 커버리지가 없는 주체는 휴리스틱으로 폴백 → **체감 품질 저하(부실)** 가 발생했다(ADR-0014가 인지·수락한 트레이드오프). ADR-0014는 보강 1순위로 **공공데이터포털**을 지목했다.

## 결정
**공공데이터포털 금융위원회 기업기본정보**(데이터셋 15043184, `GetCorpBasicInfoService_V2/getCorpOutline_V2`)를 **Layer B** 소스로 추가한다.
- **라이선스 근거**: data.go.kr 이용허락범위 **"제한 없음"(상업적 이용 OK)** + 무료 + 활용신청 자동승인. CC BY-SA(위키)와 함께 재가공·저장·수익화가 라이선스상 안전한 토대.
- 신규 `SourceType = 'publicdata'`(packages/shared 계약 추가) · 한글 배지 '공공데이터'. 권위도(`baseConfidence`) 0.88(위키 0.85 위, official 0.9 아래).
- **키 게이트**(naver 패턴): `DATA_GO_KR_SERVICE_KEY` 미설정 시 `isEnabled()=false` → registry 자동 제외(무료 운영 기본 비활성). 키 입력 시 자동으로 LLM 리포트 입력(Layer B)에 합류.

## 구현 요지
- 호출 호스트 `apis.data.go.kr`(포털 `www.data.go.kr`과 다름) → SSRF allowHosts에 별도 등록. GET이라 HTTP-POST 불요.
- **이중 인코딩 함정**: 포털의 'Decoding' 키를 `.env`에 넣고 어댑터가 `encodeURIComponent`로 **정확히 1회** 인코딩(`.env.example`·env.ts 주석에 명시). serviceKey는 URL에 실리지만 orchestrator가 rejection reason을 버려(allSettled) 로그 누출 경로 없음.
- **방어적 파싱**: 단건 결과는 `items.item`이 객체로 옴 → 배열 정규화. 같은 회사(crno)의 기준일자별 여러 행은 **최신 `basDt` 1건**으로 접고, 질의에 **이름이 가장 잘 맞는 회사 1건만** emit(질의는 한 주체에 대한 것 + 단건이라 dedup URL 충돌 회피).
- **PIPA 보수**: 스니펫은 **비개인 법인 공개사실(설립일·업종·본사)만**. 대표자명·전화번호 등 개인정보 인접 필드는 의도적으로 제외(컴플라이언스 레이어이므로 공인이라도 개인명 회피).

## 대안
- **Tavily(유료 상업 웹검색)**: 한국어/시의성 깊이는 더 크나 종량 과금 + HTTP-POST 선행 필요 → 후순위(트래픽 확인 후, ADR-0005 부분 해제).
- **현상 유지(위키만)**: 무료지만 리포트 빈약 지속 → 사용자 체감 저하 방치라 기각.
- **무료 단계 네이버 재가공 재허용**: ADR-0014가 약관 위반으로 이미 기각.

## 트레이드오프
- (+) 합법적(상업 OK) 한국어 **기업 사실데이터**로 Layer B 깊이를 0원으로 보강. 핵심 유스케이스(기업 검색)의 LLM 그라운딩 강화.
- (−) **커버리지 = 상장사 한정** — 비상장·인물·제품 질의엔 빈 결과(graceful 0, 미기여). 폭넓은 깊이는 Tavily/추가 소스로 후속.
- (−) 단건만 emit → "삼성" 같은 모호 질의는 best-match 1건(디스앰비규에이션 목록 아님). MVP 수용, 필요 시 회사별 고유 링크 소스 도입 후 재검토.
- (−) **⚠️ 라이브 검증 1건(키 발급 후)**: `basDt`(기준일자) 필수 여부와 단건 객체화·`resultType=json` 동작. 코드는 셋 다 방어적으로 처리하되 실 응답 확인 필요(미충족 시 빈 결과로 폴백 — 무해).

## 영향
- packages/shared `SOURCE_TYPES`에 'publicdata' 추가(가산적·하위호환) → FE `SOURCE_TYPE_LABELS` 라벨 동반 추가(동 PR, `Record<SourceType>` 타입이 강제).
- `report.ts`의 Layer B 게이트로 별도 코드 변경 없이 자동 합류 — 키 입력 환경에서 LLM 입력에 기업 사실 노드가 더해진다.
- render.yaml에 `DATA_GO_KR_SERVICE_KEY`(sync:false) 선언. 값은 대시보드에서만 입력.
