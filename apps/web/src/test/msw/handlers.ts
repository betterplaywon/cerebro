import { http, HttpResponse } from 'msw';
import type { GraphSnapshot } from '@cerebro/shared';

const API = 'http://localhost:8787';

/** 계약(GraphSnapshotSchema)을 만족하는 최소 그래프 — 검색어를 중심 라벨로 에코. */
export function makeGraph(query: string): GraphSnapshot {
  return {
    subject: { id: 'subject-1', query, type: 'unknown', displayName: query },
    nodes: [{ id: 'center', label: query, kind: 'center', importance: 1, confidence: 0.9, sourceIds: [] }],
    edges: [],
    sources: [],
    generatedAt: '2026-06-26T00:00:00.000Z',
  };
}

/** 기본 핸들러: POST /api/search → 계약 만족 그래프. 테스트별로 server.use()로 덮어쓸 수 있다. */
export const handlers = [
  http.post(`${API}/api/search`, async ({ request }) => {
    const body = (await request.json()) as { query?: string };
    return HttpResponse.json({ graph: makeGraph(body.query ?? ''), cached: false });
  }),
];
