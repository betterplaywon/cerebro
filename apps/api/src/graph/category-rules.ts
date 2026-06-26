import type { NodeKind, Source, SubjectType } from '@cerebro/shared';

/**
 * 수집 출처(Source)를 노드 카테고리(NodeKind)로 분류한다 — 3D 마인드맵 카테고리 색의 근거.
 *
 * 설계 원칙(보수성): **출처 출처지(provenance: source.type + URL 호스트)** 가 먼저 결정하고,
 * 모호한 한국어 텍스트 마커는 호스트/타입 규칙이 모두 빗나간 뒤에만 발화한다. 무엇도 확정 못 하면
 * 'concept'로 떨어진다(틀린 특정 분류보다 보수적 일반 분류가 안전). 'center'·'attribute'는 여기서
 * 만들지 않는다(중심은 별도 지정, 속성 잎은 빌더 몫).
 *
 * PIPA: 'person'은 **공인 한정** + 백과 출처 + 역할 마커 + 이름 식별이 모두 충족될 때만(personGuard).
 */

/** 최신성 판정 창. 게시일이 수집일로부터 이 기간 이내면 '최근'으로 본다. */
const RECENCY_WINDOW_DAYS = 180;
const RECENCY_WINDOW_MS = RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** 출처 호스트 화이트리스트(카테고리별). 네이버는 특정 서브도메인만(맨 'naver.com'은 금지). */
const HOSTS = {
  news: [
    'news.naver.com', 'n.news.naver.com', 'yna.co.kr', 'yonhapnews.co.kr', 'newsis.com', 'news1.kr',
    'chosun.com', 'joongang.co.kr', 'donga.com', 'hani.co.kr', 'khan.co.kr', 'hankookilbo.com',
    'kmib.co.kr', 'seoul.co.kr', 'munhwa.com', 'segye.com', 'mk.co.kr', 'hankyung.com', 'mt.co.kr',
    'edaily.co.kr', 'sedaily.com', 'fnnews.com', 'asiae.co.kr', 'heraldcorp.com', 'dt.co.kr',
    'etnews.com', 'zdnet.co.kr', 'bloter.net', 'inews24.com', 'ddaily.co.kr', 'kbs.co.kr', 'imbc.com',
    'mbc.co.kr', 'sbs.co.kr', 'ytn.co.kr', 'jtbc.co.kr', 'nocutnews.co.kr', 'ohmynews.com',
    'pressian.com', 'mediatoday.co.kr', 'dailian.co.kr', 'newdaily.co.kr',
  ],
  blog: ['blog.naver.com', 'post.naver.com', 'tistory.com', 'brunch.co.kr', 'blog.daum.net', 'velog.io', 'medium.com', 'egloos.com', 'postype.com'],
  community: [
    'cafe.naver.com', 'cafe.daum.net', 'dcinside.com', 'gall.dcinside.com', 'fmkorea.com', 'clien.net',
    'ruliweb.com', 'mlbpark.donga.com', 'ppomppu.co.kr', 'theqoo.net', 'instiz.net', 'bobaedream.co.kr',
    'todayhumor.co.kr', '82cook.com', 'inven.co.kr', 'arca.live', 'etoland.co.kr', 'slrclub.com',
    'humoruniv.com', 'quasarzone.com', 'coolenjoy.net', 'damoang.net', 'reddit.com',
  ],
  store: ['apps.apple.com', 'itunes.apple.com', 'play.google.com', 'apps.samsung.com', 'galaxystore.samsung.com', 'onestore.co.kr'],
  sns: [
    'instagram.com', 'youtube.com', 'youtu.be', 'facebook.com', 'fb.com', 'twitter.com', 'x.com',
    'tiktok.com', 'threads.net', 'linkedin.com', 'pf.kakao.com', 'story.kakao.com', 'band.us',
    'pinterest.com', 'weverse.io', 'chzzk.naver.com',
  ],
  encyclopedic: ['ko.wikipedia.org', 'wikipedia.org', 'namu.wiki', 'terms.naver.com'],
} as const;

/** 제목·스니펫에 등장하면 해당 카테고리를 시사하는 한국어 마커. */
const MARKERS = {
  news: ['기자', '단독', '속보', '보도', '취재', '인터뷰', '일보', '연합뉴스', '뉴스1', '헤럴드', '보도자료', '밝혔다', '전했다', '발표', '종합'],
  reputation: ['후기', '리뷰', 'review', '평점', '별점', '내돈내산', '솔직후기', '사용기', '사용후기', '장단점', '추천', '비추', '실사용', '가성비', '만족도', '불만', '호불호', '협찬'],
  product: ['출시', '신제품', '신상', '요금제', '가격', '정가', '출고가', '스펙', '사양', '기능', '다운로드', '설치', '버전', '업데이트', '라인업', '무료체험', '구독', '베타', '모델명'],
  person: ['대표이사', '대표', '창업자', '공동창업자', '회장', '부회장', '사장', 'ceo', '의장', '감독', '배우', '가수', '아이돌', '선수', '작가', '교수', '박사', '의원', '장관', '시장', '도지사', '본명', '출생', '데뷔', '프로필'],
} as const;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  } catch {
    return '';
  }
}

/** host가 목록의 항목과 정확히 일치하거나 그 하위 도메인이면 true. */
function hostMatch(host: string, list: readonly string[]): boolean {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/** 공공기관(.go.kr/.or.kr) 도메인. */
function isOfficialHost(host: string): boolean {
  return host.endsWith('.go.kr') || host.endsWith('.or.kr');
}

function hasMarker(text: string, list: readonly string[]): boolean {
  return list.some((marker) => text.includes(marker));
}

function isRecent(source: Source): boolean {
  if (!source.publishedAt) return false;
  const published = Date.parse(source.publishedAt);
  const collected = Date.parse(source.collectedAt);
  if (Number.isNaN(published) || Number.isNaN(collected)) return false;
  return collected - published <= RECENCY_WINDOW_MS;
}

/** 제목이 2~4음절 한글 고유명사(인명) 형태인가. " - 위키백과", "(기업인)" 등 부가 표기는 제거 후 판정. */
function looksLikePersonName(title: string): boolean {
  const head = (title.split(/\s[-–—]\s/)[0] ?? title).trim(); // " - 위키백과 …" 같은 꼬리 제거
  const base = head.replace(/\s*\([^)]*\)\s*$/, '').trim(); // 끝의 (구분자) 제거
  return /^[가-힣]{2,4}$/.test(base);
}

/**
 * PIPA 가드: 공인 인물 노드는 (a)백과/위키 출처 + (b)공개 역할 마커 + (c)인명 식별이 모두 충족될 때만.
 * 블로그·커뮤니티·뉴스·일반웹에 단지 '언급'된 인물은 그 출처의 카테고리에 남는다(인물 노드 금지).
 */
function isPersonNode(source: Source, host: string, text: string, subjectType?: SubjectType): boolean {
  const provenance = hostMatch(host, HOSTS.encyclopedic) || source.type === 'wikipedia';
  if (!provenance) return false;
  if (!hasMarker(text, MARKERS.person)) return false;
  return subjectType === 'person' || looksLikePersonName(source.title);
}

/**
 * 출처 → 노드 카테고리. 우선순위 규칙(가장 구체적 → 일반, 첫 매치 승):
 * SNS → 스토어(앱) → 스토어(웹유입) → 뉴스호스트 → 커뮤니티 → 블로그 → 공공/공식 → 인물 →
 * 백과 → (거친웹)최근+뉴스마커 → 평판마커 → 제품마커 → concept(폴백).
 */
export function classifySource(source: Source, subjectType?: SubjectType): NodeKind {
  const host = hostOf(source.url);
  const text = `${source.title} ${source.snippet ?? ''}`.toLowerCase();
  const coarseWeb = source.type === 'naver' || source.type === 'google' || source.type === 'web';

  if (source.type === 'sns' || hostMatch(host, HOSTS.sns)) return 'channel';
  if (source.type === 'appstore' || source.type === 'playstore') return 'product';
  if (hostMatch(host, HOSTS.store)) return 'channel';
  if (hostMatch(host, HOSTS.news)) return 'news';
  if (source.type === 'community' || hostMatch(host, HOSTS.community)) return 'reputation';
  if (source.type === 'blog' || hostMatch(host, HOSTS.blog)) return 'reputation';
  if (source.type === 'official' || isOfficialHost(host)) return 'channel';
  if (isPersonNode(source, host, text, subjectType)) return 'person';
  if (hostMatch(host, HOSTS.encyclopedic) || source.type === 'wikipedia') return 'concept';
  if (coarseWeb && isRecent(source) && hasMarker(text, MARKERS.news)) return 'news';
  if (coarseWeb && hasMarker(text, MARKERS.reputation)) return 'reputation';
  // 'official'은 위 규칙 7에서 이미 channel로 확정되므로 여기서는 거친웹만 본다.
  if (coarseWeb && hasMarker(text, MARKERS.product)) return 'product';
  return 'concept';
}
