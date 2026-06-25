# ADR-0001 — 그래프 계약은 `packages/shared`가 단일 진실 공급원(SSOT)

- 상태: Accepted
- 일자: 2026-06-25

## 맥락
문서 검증에서 zod 스키마 명칭이 문서마다 달랐다(`NodeSchema` vs `GraphNodeSchema`, `GraphSchema` vs `GraphSnapshotSchema`), `SearchRequest`는 어디에도 정의되지 않았다. 노드/출처 필드도 UX-SPEC(`sources[]`, `trust`)와 DATA-MODEL(`sourceId`, `confidence`)이 불일치했다.

## 결정
FE↔BE 계약의 **코드(`packages/shared`)를 SSOT**로 삼는다. 정식 명칭과 형태는 다음으로 고정한다.

- 스키마: `SourceSchema`, `SubjectSchema`, `GraphNodeSchema`, `GraphEdgeSchema`, `GraphSnapshotSchema`, `SearchRequestSchema`, `SearchResponseSchema`.
- 출처 표현: 노드는 `sourceIds: string[]`로 참조하고 실제 `Source`는 `GraphSnapshot.sources`에 한 번만 둔다. **MVP는 노드당 0~1개**를 채우되 배열로 두어 다중 출처를 무중단 확장한다. (UX `sources[]` ↔ DATA-MODEL 대표출처 정합)
- 신뢰도 필드명은 `confidence`(0~1)로 통일(UX의 `trust`는 표시 라벨일 뿐 계약 필드 아님).

문서가 옛 명칭(`NodeSchema` 등)을 쓰면 위 정식 스키마를 가리키는 것으로 해석한다.

## 대안
- 문서를 SSOT로: 코드와 항상 어긋날 위험 → 기각.
- 노드에 `Source` 객체 임베드: 중복·일관성 비용 → 참조(id) 방식 채택.

## 트레이드오프
참조 방식은 UI에서 `sourceIds → sources` 해석 한 단계가 필요하지만, 중복 제거·다중 출처 확장·캐시 효율에서 이득이 크다.
