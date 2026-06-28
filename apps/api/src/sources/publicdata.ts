import { z } from 'zod';
import { fetchJson } from '../lib/http.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { env } from '../env.js';
import type { CollectContext, RawItem, SourceAdapter } from './types.js';

/**
 * 공공데이터포털(data.go.kr) 금융위원회 기업기본정보 어댑터 — Layer B(상업 OK).
 * 데이터셋 15043184(이용허락범위 '제한 없음') · 금융위 getCorpOutline_V2.
 * 상장사의 구조화된 공개 사실데이터(설립일·업종·본사)를 LLM 리포트 입력으로 제공해
 * Layer B 한국어 깊이를 보강한다(ADR-0014로 네이버·카카오가 분석 입력에서 빠진 뒤의 보강 — ADR-0015).
 *
 * 키(DATA_GO_KR_SERVICE_KEY) 미설정 시 isEnabled()=false → registry 자동 제외(무료 운영 기본 비활성).
 *
 * ⚠️ 라이브 검증 필요(키 발급 후): ① basDt(기준일자) 필수 여부 — 누락 시 빈 응답 가능,
 *    ② 단건 결과의 items.item 객체화, ③ resultType=json 동작. 코드는 셋 다 방어적으로 처리한다.
 */

const API_HOST = 'apis.data.go.kr';
const ALLOW_HOSTS = [API_HOST];
const ENDPOINT = '/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2';
/** 출처 표기용 데이터셋 페이지(검증 가능한 출처 — 단건만 emit하므로 dedup 충돌 없음). */
const DATASET_PAGE = 'https://www.data.go.kr/data/15043184/openapi.do';
/** 동일 회사가 기준일자별 여러 행으로 올 수 있어 넉넉히 받고 crno로 최신 1건만 추린다. */
const NUM_OF_ROWS = 100;
/** data.go.kr 정상 응답 코드. 그 외(키 오류 등)는 빈 결과로 처리. */
const RESULT_CODE_OK = '00';

/** 선택 문자열 필드. resultType=json은 값을 문자열(또는 생략)로 주므로 평이한 string 검증이면 충분하다.
 *  (드물게 null이 오면 해당 응답 파싱이 실패 → 어댑터가 빈 결과로 폴백 — 키 발급 후 라이브 검증 항목). */
const optStr = z.string().optional();

/** 기업 개요 항목(외부 경계 — 사용하는 필드만, 나머지 무시). 개인정보 필드(대표자명·전화)는 의도적으로 미사용. */
const CorpItemSchema = z.object({
  corpNm: optStr, // 법인명
  crno: optStr, // 법인등록번호(중복 회사 식별 키)
  enpEstbDt: optStr, // 설립일 YYYYMMDD
  sicNm: optStr, // 표준산업분류 업종명
  enpBsadr: optStr, // 본점 소재지(법인 공개 주소 — 개인 주소 아님)
  basDt: optStr, // 기준일자 YYYYMMDD(최신행 선택용)
});
type CorpItem = z.infer<typeof CorpItemSchema>;

/**
 * items 봉투: 다건이면 { item: [...] }, 단건이면 { item: {...} }(data.go.kr 공통 객체화),
 * 결과 없음이면 빈 문자열('')/누락으로 온다. 배열 정규화는 호출부에서 처리한다.
 */
const ItemsSchema = z.union([
  z.literal(''),
  z.object({ item: z.union([CorpItemSchema, z.array(CorpItemSchema)]).optional() }),
]);

const ResponseSchema = z.object({
  response: z
    .object({
      header: z.object({ resultCode: optStr, resultMsg: optStr }).optional(),
      body: z.object({ items: ItemsSchema.optional() }).optional(),
    })
    .optional(),
});

export interface PublicDataDeps {
  serviceKey?: string;
  fetchImpl?: typeof fetch;
}

export function createPublicDataAdapter(deps: PublicDataDeps = {}): SourceAdapter {
  // 단일 엔드포인트(쿼리당 1회)라 호출 간격은 정중함 수준(300ms)으로 충분.
  // 재시도 2회: Layer B는 일일 쿼터 압박이 없어 일시적 오류엔 회복력을 우선한다.
  const limiter = createRateLimiter(300);

  return {
    id: 'publicdata',
    sourceType: 'publicdata',
    layer: 'B', // 이용허락범위 '제한 없음'(상업 OK) — LLM 리포트·7일 캐시 입력 가능. ADR-0015.
    requiresKey: true,
    isEnabled: () => Boolean(deps.serviceKey),
    async collect({ query }: CollectContext): Promise<RawItem[]> {
      if (!deps.serviceKey) return [];
      await limiter.acquire();

      // serviceKey는 'Decoding' 키 가정 → encodeURIComponent로 정확히 1회 인코딩(이중 인코딩 함정 회피).
      const url =
        `https://${API_HOST}${ENDPOINT}` +
        `?serviceKey=${encodeURIComponent(deps.serviceKey)}` +
        `&resultType=json&numOfRows=${NUM_OF_ROWS}&pageNo=1` +
        `&corpNm=${encodeURIComponent(query)}`;

      const data = await fetchJson(url, {
        allowHosts: ALLOW_HOSTS,
        fetchImpl: deps.fetchImpl,
        headers: { accept: 'application/json' },
        retries: 2,
        schema: ResponseSchema,
      });

      const code = data?.response?.header?.resultCode;
      if (code && code !== RESULT_CODE_OK) return []; // 키 오류·서비스 오류 등은 빈 결과로 폴백.

      const itemsField = data?.response?.body?.items;
      const item = itemsField && typeof itemsField === 'object' ? itemsField.item : undefined;
      const rows: CorpItem[] = item === undefined ? [] : Array.isArray(item) ? item : [item];
      const best = pickBestCompany(rows, query);
      if (!best?.corpNm) return [];

      const snippet = buildFactSnippet(best);
      return [{ title: best.corpNm, url: DATASET_PAGE, snippet }];
    },
  };
}

export const publicDataAdapter = createPublicDataAdapter({
  serviceKey: env.DATA_GO_KR_SERVICE_KEY,
});

/**
 * 검색 주체에 가장 잘 맞는 회사 1건을 고른다(질의는 한 주체에 대한 것이므로 목록이 아닌 단건).
 * 우선순위: 법인 접미사 제거 후 정확 일치 → 최신 기준일자. crno로 같은 회사의 과거 기준일자 행은 접는다.
 */
function pickBestCompany(rows: CorpItem[], query: string): CorpItem | null {
  const named = rows.filter((r) => r.corpNm && r.corpNm.length > 0);
  if (named.length === 0) return null;

  // 같은 회사(crno)의 여러 기준일자 행 → 최신 basDt 1건만 유지.
  const latestByCorp = new Map<string, CorpItem>();
  for (const r of named) {
    const key = r.crno ?? r.corpNm!;
    const prev = latestByCorp.get(key);
    if (!prev || (r.basDt ?? '') > (prev.basDt ?? '')) latestByCorp.set(key, r);
  }
  const companies = [...latestByCorp.values()];

  const target = normalizeCorpName(query);
  const exact = companies.find((c) => normalizeCorpName(c.corpNm!) === target);
  if (exact) return exact;

  // 정확 일치가 없으면 가장 최신 기준일자의 회사(가장 현행 데이터).
  return companies.reduce((a, b) => ((b.basDt ?? '') > (a.basDt ?? '') ? b : a));
}

/** 법인 접미사·공백 제거 후 비교(삼성전자 ↔ 삼성전자주식회사 매칭). */
function normalizeCorpName(name: string): string {
  return name.replace(/주식회사|\(주\)|（주）|㈜|\s+/g, '').trim();
}

/**
 * 비개인 법인 공개사실만으로 스니펫 구성(설립일·업종·본사).
 * 대표자명·전화번호 등 개인정보 인접 필드는 의도적으로 제외(PIPA 보수 — 컴플라이언스 레이어).
 */
function buildFactSnippet(c: CorpItem): string | undefined {
  const estb = formatYmd(c.enpEstbDt);
  const facts = [
    estb && `설립 ${estb}`,
    c.sicNm && `업종 ${c.sicNm}`,
    c.enpBsadr && `본사 ${c.enpBsadr}`,
  ].filter((x): x is string => Boolean(x));
  return facts.length > 0 ? facts.join(' · ') : undefined;
}

/** 'YYYYMMDD' → 'YYYY-MM-DD'. 형식이 아니면 undefined. */
function formatYmd(ymd?: string): string | undefined {
  if (!ymd || !/^\d{8}$/.test(ymd)) return undefined;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
