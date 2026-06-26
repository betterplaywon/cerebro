import { describe, expect, it } from 'vitest';
import type { NodeKind, Source, SourceType, SubjectType } from '@cerebro/shared';
import { classifySource } from './category-rules.js';

const COLLECTED_AT = '2026-06-26T00:00:00.000Z';
const RECENT = '2026-06-20T00:00:00.000Z'; // 수집일 기준 6일 전(최신 창 180일 이내)

interface Case {
  title: string;
  url: string;
  type: SourceType;
  snippet?: string;
  publishedAt?: string;
  subjectType?: SubjectType;
  expected?: NodeKind;
}

function mk(c: Case): Source {
  return {
    id: 's',
    type: c.type,
    title: c.title,
    url: c.url,
    snippet: c.snippet,
    publishedAt: c.publishedAt,
    collectedAt: COLLECTED_AT,
    confidence: 0.6,
  };
}

describe('classifySource — 뉴스(news)', () => {
  const cases: Case[] = [
    { title: '비바리퍼블리카, 9000억 신규 투자 유치', url: 'https://www.yna.co.kr/view/AKR20260612', type: 'naver', publishedAt: RECENT, expected: 'news' },
    { title: '토스, 개인정보 논란 공식 사과', url: 'https://n.news.naver.com/mnews/article/032/0003299123', type: 'naver', publishedAt: RECENT, expected: 'news' },
    { title: '토스 PG업 등록 승인', url: 'https://www.hankyung.com/article/2026061878', type: 'naver', publishedAt: RECENT, expected: 'news' },
    { title: '토스 새 앱 리뷰…광고 논란', url: 'https://zdnet.co.kr/view/?no=20260622', type: 'naver', publishedAt: RECENT, expected: 'news' },
    { title: '이승건 토스 대표 동남아 공략', url: 'https://www.mk.co.kr/news/it/10812345', type: 'naver', publishedAt: RECENT, expected: 'news' },
    // rule 10: 비언론 호스트지만 최근 게시 + 뉴스 마커(보도자료)
    { title: '[보도자료] 토스, 무료 신용관리 출시', url: 'https://toss.im/newsroom/press/credit', type: 'naver', snippet: '토스가 밝혔다. 보도자료', publishedAt: RECENT, expected: 'news' },
  ];
  it.each(cases)('$url → news', (c) => expect(classifySource(mk(c), c.subjectType)).toBe(c.expected));
});

describe('classifySource — 평판(reputation)', () => {
  const cases: Case[] = [
    { title: '토스 카드 6개월 내돈내산 솔직후기', url: 'https://blog.naver.com/finlife/2238123', type: 'naver', expected: 'reputation' },
    { title: '토스뱅크 적금 한 달 사용기', url: 'https://moneydiary.tistory.com/142', type: 'naver', expected: 'reputation' },
    { title: '토스 요즘 어떰? 갈아탈만한가', url: 'https://gall.dcinside.com/board/view/?id=stock&no=123', type: 'naver', publishedAt: RECENT, expected: 'reputation' },
    { title: '토스 고객센터 별로네요', url: 'https://cafe.naver.com/moneytalk/9912345', type: 'naver', expected: 'reputation' },
    { title: '토스 직원 갑질 폭로 논란', url: 'https://www.fmkorea.com/best/7654321', type: 'naver', publishedAt: RECENT, expected: 'reputation' },
    { title: '토스는 어떻게 1등 금융앱이 되었나', url: 'https://brunch.co.kr/@uxwriter/77', type: 'blog', expected: 'reputation' },
  ];
  it.each(cases)('$url → reputation', (c) => expect(classifySource(mk(c), c.subjectType)).toBe(c.expected));
});

describe('classifySource — 채널(channel)', () => {
  const cases: Case[] = [
    { title: '토스 - YouTube', url: 'https://www.youtube.com/@toss', type: 'naver', expected: 'channel' },
    { title: '토스 Instagram', url: 'https://www.instagram.com/toss.official/', type: 'naver', expected: 'channel' },
    { title: '토스 / X', url: 'https://x.com/tossteam', type: 'sns', expected: 'channel' },
    { title: '비바리퍼블리카 기업개황 | DART', url: 'https://dart.fss.or.kr/dsae001/selectPopup.ax', type: 'naver', expected: 'channel' },
    { title: '토스 - Google Play', url: 'https://play.google.com/store/apps/details?id=viva.republica.toss', type: 'naver', publishedAt: RECENT, expected: 'channel' },
    { title: '토스 - App Store', url: 'https://apps.apple.com/kr/app/toss/id839333328', type: 'naver', expected: 'channel' },
  ];
  it.each(cases)('$url → channel', (c) => expect(classifySource(mk(c), c.subjectType)).toBe(c.expected));
});

describe('classifySource — 제품(product)', () => {
  const cases: Case[] = [
    { title: '토스 신상 요금제 라인업 출시', url: 'https://shop.example.co.kr/toss-plan', type: 'naver', snippet: '가격·기능 한눈에', expected: 'product' },
    // 비언론 호스트 + 제품 마커(뉴스 마커·뉴스 호스트 없음) → product (코퍼스의 기대 news는 호스트-only 규칙과 상충 → 알고리즘대로 product)
    { title: '갤럭시 S26 신제품 출시…출고가·스펙 공개', url: 'https://www.fintechreport.co.kr/news/galaxy-s26', type: 'web', publishedAt: RECENT, expected: 'product' },
  ];
  it.each(cases)('$url → product', (c) => expect(classifySource(mk(c), c.subjectType)).toBe(c.expected));
});

describe('classifySource — concept(폴백·백과)', () => {
  const cases: Case[] = [
    { title: '비바리퍼블리카 - 위키백과, 우리 모두의 백과사전', url: 'https://ko.wikipedia.org/wiki/비바리퍼블리카', type: 'wikipedia', subjectType: 'company', expected: 'concept' },
    { title: '간편결제 - 위키백과, 우리 모두의 백과사전', url: 'https://ko.wikipedia.org/wiki/간편결제', type: 'wikipedia', expected: 'concept' },
    { title: '토스(금융) - 나무위키', url: 'https://namu.wiki/w/토스(금융)', type: 'naver', expected: 'concept' },
    { title: '비바리퍼블리카 기업정보 - 업종/설립일', url: 'https://www.saramin.co.kr/company-info/view?csn=123', type: 'naver', expected: 'concept' },
    { title: '회사소개 - 비바리퍼블리카', url: 'https://toss.im/about', type: 'naver', expected: 'concept' },
    { title: '2026 국내 핀테크 시장 동향 리포트', url: 'https://www.fintechreport.co.kr/insight/2026', type: 'web', publishedAt: RECENT, expected: 'concept' },
  ];
  it.each(cases)('$url → concept', (c) => expect(classifySource(mk(c), c.subjectType)).toBe(c.expected));
});

describe('classifySource — 인물(person, PIPA 가드)', () => {
  it('백과 출처 + 역할 마커 + 인명 식별이면 person', () => {
    expect(
      classifySource(
        mk({ title: '이승건(기업인) - 나무위키', url: 'https://namu.wiki/w/이승건(기업인)', type: 'naver', snippet: '비바리퍼블리카 공동창업자이자 대표' }),
        'company',
      ),
    ).toBe('person');
    expect(
      classifySource(
        mk({ title: '이승건 (기업인) - 위키백과, 우리 모두의 백과사전', url: 'https://ko.wikipedia.org/wiki/이승건_(기업인)', type: 'wikipedia', snippet: '토스를 창업한 대표이사' }),
        'company',
      ),
    ).toBe('person');
  });

  it('subjectType=person + 위키 + 역할 마커면 person', () => {
    expect(
      classifySource(
        mk({ title: '봉준호', url: 'https://ko.wikipedia.org/wiki/봉준호', type: 'wikipedia', snippet: '대한민국의 영화 감독' }),
        'person',
      ),
    ).toBe('person');
  });

  it('PIPA 음성: 뉴스에 언급된 인물은 news로 남는다(인물 노드 금지)', () => {
    expect(
      classifySource(mk({ title: '이승건 토스 대표 인터뷰', url: 'https://www.mk.co.kr/news/it/108', type: 'naver', snippet: '대표는 밝혔다', publishedAt: RECENT })),
    ).toBe('news');
  });

  it('PIPA 음성: 블로그에 언급된 인물은 reputation으로 남는다', () => {
    expect(
      classifySource(mk({ title: '이승건 대표 후기', url: 'https://blog.naver.com/x/1', type: 'naver', snippet: '대표 인터뷰 후기' })),
    ).toBe('reputation');
  });

  it('PIPA 음성: 역할 마커 없으면 백과 인명도 person 아님(concept)', () => {
    expect(
      classifySource(mk({ title: '간편결제 - 위키백과', url: 'https://ko.wikipedia.org/wiki/간편결제', type: 'wikipedia', snippet: '온라인 결제 방식' })),
    ).toBe('concept');
  });
});
