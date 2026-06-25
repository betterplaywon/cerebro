import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GraphSnapshotSchema } from '@cerebro/shared';
import { buildServer } from './server.js';

describe('cerebro api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('POST /api/search → 계약을 만족하는 그래프 반환', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: '토스' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cached).toBe(false);
    // 응답 그래프가 SSOT 계약을 만족하는지
    expect(() => GraphSnapshotSchema.parse(body.graph)).not.toThrow();
    expect(body.graph.nodes.find((n: { kind: string }) => n.kind === 'center')?.label).toBe('토스');
  });

  it('POST /api/search → 빈 검색어는 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_REQUEST');
  });
});
