import { describe, expect, it, vi } from 'vitest';
import { createPublicDataAdapter } from './publicdata.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** 금융위 getCorpOutline_V2 성공 응답 봉투. items.item 은 객체(단건) 또는 배열(다건). */
function envelope(item: unknown, resultCode = '00') {
  return {
    response: {
      header: { resultCode, resultMsg: 'NORMAL SERVICE' },
      body: { items: { item } },
    },
  };
}

const SAMSUNG = {
  corpNm: '삼성전자주식회사',
  crno: '1301110006246',
  enpEstbDt: '19690113',
  sicNm: '통신·방송 장비 제조업',
  enpBsadr: '경기도 수원시 영통구',
  enpRprFnm: '홍길동', // 대표자명 — 스니펫에 노출되면 안 됨
  enpTlno: '031-200-1114', // 전화 — 스니펫에 노출되면 안 됨
  basDt: '20250601',
};

describe('publicDataAdapter', () => {
  it('기업 개요를 비개인 사실 스니펫(설립·업종·본사)으로 매핑한다', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([SAMSUNG]))));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });

    const items = await adapter.collect({ query: '삼성전자' });

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('삼성전자주식회사');
    expect(items[0]?.url).toBe('https://www.data.go.kr/data/15043184/openapi.do');
    expect(items[0]?.snippet).toBe('설립 1969-01-13 · 업종 통신·방송 장비 제조업 · 본사 경기도 수원시 영통구');
  });

  it('대표자명·전화번호 등 개인정보 인접 필드는 스니펫에서 제외한다(PIPA 보수)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([SAMSUNG]))));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    const items = await adapter.collect({ query: '삼성전자' });
    expect(items[0]?.snippet).not.toContain('홍길동');
    expect(items[0]?.snippet).not.toContain('031');
  });

  it('단건 결과(items.item이 객체)도 배열로 정규화해 처리한다', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope(SAMSUNG)))); // 배열 아님
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    const items = await adapter.collect({ query: '삼성전자' });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('삼성전자주식회사');
  });

  it('같은 회사(crno)의 기준일자별 여러 행은 최신 basDt 1건으로 접는다', async () => {
    const old = { ...SAMSUNG, sicNm: '구업종', basDt: '20230101' };
    const recent = { ...SAMSUNG, sicNm: '신업종', basDt: '20250601' };
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([old, recent]))));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    const items = await adapter.collect({ query: '삼성전자' });
    expect(items).toHaveLength(1);
    expect(items[0]?.snippet).toContain('업종 신업종');
  });

  it('이름이 정확히 일치하는 회사를 최신 기준일자 회사보다 우선한다', async () => {
    const target = { ...SAMSUNG, corpNm: '삼성전자주식회사', crno: '111', basDt: '20240101' };
    const other = { corpNm: '삼성SDI주식회사', crno: '222', enpEstbDt: '19700101', basDt: '20250601' };
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([target, other]))));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    const items = await adapter.collect({ query: '삼성전자' });
    expect(items[0]?.title).toBe('삼성전자주식회사');
  });

  it('결과 없음(items 빈 문자열)을 안전하게 처리한다', async () => {
    const body = { response: { header: { resultCode: '00' }, body: { items: '' } } };
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(body)));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    expect(await adapter.collect({ query: '없는회사' })).toEqual([]);
  });

  it('정상 코드(00)가 아니면 빈 배열을 반환한다(키 오류 등)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([SAMSUNG], '30'))));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    expect(await adapter.collect({ query: '삼성전자' })).toEqual([]);
  });

  it('비정상 HTTP 응답(5xx)이면 빈 배열을 반환한다', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({}, 503)));
    const adapter = createPublicDataAdapter({ serviceKey: 'k', fetchImpl });
    expect(await adapter.collect({ query: '삼성전자' })).toEqual([]);
  });

  it('키 미설정이면 비활성·호출 없이 빈 배열', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([SAMSUNG]))));
    const adapter = createPublicDataAdapter({ fetchImpl });
    expect(adapter.isEnabled()).toBe(false);
    expect(await adapter.collect({ query: '삼성전자' })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('serviceKey를 정확히 1회만 인코딩하고 corpNm으로 질의한다(이중 인코딩 회피)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(envelope([SAMSUNG]))));
    const adapter = createPublicDataAdapter({ serviceKey: 'a+b/c=', fetchImpl });
    await adapter.collect({ query: '카카오' });

    const url = String((fetchImpl.mock.calls[0] as unknown[])?.[0]);
    expect(url).toContain('serviceKey=a%2Bb%2Fc%3D');
    expect(url).not.toContain('%252B'); // 이중 인코딩 흔적 없음
    expect(url).toContain(`corpNm=${encodeURIComponent('카카오')}`);
    expect(url).toContain('resultType=json');
  });
});
