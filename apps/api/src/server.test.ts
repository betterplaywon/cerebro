import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GraphSnapshotSchema } from '@cerebro/shared';
import { buildServer } from './server.js';
import { exampleAdapter } from './sources/example.js';

describe('cerebro api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // 테스트는 fixture 어댑터 주입 → 외부 네트워크 없이 결정적
    app = buildServer({ adapters: [exampleAdapter] });
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

  it('POST /api/search → 동일 검색은 캐시 히트(cached=true)', async () => {
    const first = await app.inject({ method: 'POST', url: '/api/search', payload: { query: '카카오' } });
    expect(first.json().cached).toBe(false);
    const second = await app.inject({ method: 'POST', url: '/api/search', payload: { query: '카카오' } });
    expect(second.json().cached).toBe(true);
    // 캐시 히트도 동일 그래프(계약 만족)
    expect(second.json().graph.subject.query).toBe('카카오');
  });

  it('없는 경로 → 404를 일관 에러 스키마로 반환', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('잘못된 JSON 바디 → 미처리 오류도 ApiError(4xx)로 일관 응답', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(res.statusCode).toBe(400);
    expect(typeof res.json().error.code).toBe('string');
    expect(typeof res.json().error.message).toBe('string');
  });
});
