import { describe, expect, it } from 'vitest';
import { lastJongseong, stripParticle } from './korean.js';

describe('lastJongseong', () => {
  it('모음 종결은 0, 받침은 0이 아닌 값을 돌려준다', () => {
    expect(lastJongseong('토스')).toBe(0); // 스 = 받침 없음
    expect(lastJongseong('삼성')).not.toBe(0); // 성 = ㅇ 받침
    expect(lastJongseong('서울')).toBe(8); // 울 = ㄹ 받침
  });

  it('완성형 한글이 아니면 null', () => {
    expect(lastJongseong('app')).toBeNull();
    expect(lastJongseong('5g')).toBeNull();
    expect(lastJongseong('')).toBeNull();
  });
});

describe('stripParticle — 조사 분리(true positive)', () => {
  // [입력, 기대 어간] — 같은 개체가 한 토큰으로 합쳐져야 한다.
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['토스가', '토스'], ['토스는', '토스'], ['토스를', '토스'], ['토스의', '토스'],
    ['카카오의', '카카오'], ['네이버가', '네이버'],
    ['삼성이', '삼성'], ['삼성을', '삼성'], ['쿠팡은', '쿠팡'], ['쿠팡이', '쿠팡'],
    ['대한민국의', '대한민국'],
    ['갤럭시로', '갤럭시'], ['아이폰만', '아이폰'], ['제네시스도', '제네시스'],
    ['카카오톡으로', '카카오톡'], ['당근마켓이', '당근마켓'], ['서울에', '서울'],
    ['카카오까지', '카카오'], ['손흥민에게', '손흥민'], ['손흥민은', '손흥민'],
    ['봉준호의', '봉준호'], ['아이유를', '아이유'],
  ];
  it.each(cases)('%s → %s', (input, stem) => {
    expect(stripParticle(input)).toBe(stem);
  });
});

describe('stripParticle — 오절단 방지(false positive)', () => {
  // 조사처럼 보이는 말음을 가졌지만 절단하면 안 되는 실제 단어들.
  const protectedWords = [
    // 받침 뒤 '가'(모음형 조사 불가) — 사전 없이 받침 규칙으로 차단
    '음악가', '대학가', '누군가', '전문가', '작곡가',
    // 어간 1음절(최소 길이 미달)
    '국가', '물가', '평가', '휴가', '길이', '높이', '수은',
    '정도', '제도', '포도', '속도', '회의', '정의', '강의',
    '진로', '미로', '종로', '가로', '낭만', '불만', '비만',
    // 받침 규칙: '을'(자음형)은 모음 어간 '가' 뒤에 못 옴
    '가을',
    // 조사가 아닌 말음(다/두/유) — 애초에 후보가 아님
    '바다', '소다', '판다', '보다', '모두', '이유', '자유', '만두',
    // 관형형 어미 '-는'(어간 1음절이라 보존)
    '가는', '사는',
    // 보호 단어 사전
    '어린이', '고양이', '호랑이', '민주주의', '제주도', '경기도', '만화가',
  ];
  it.each(protectedWords)('%s 는 그대로 유지된다', (word) => {
    expect(stripParticle(word)).toBe(word);
  });
});

describe('stripParticle — 실사용 오탐 회귀(adversarial)', () => {
  // 받침/길이 가드를 통과하지만 절단하면 안 되는, 자주 검색되는 실제 단어들.
  const realWorld = [
    // 도(島/지구): 받침 규칙으로 못 막는 ≥2음절 어간 지명
    '여의도', '울릉도', '거제도', '강화도', '영종도',
    // 로(路): 거리·역명
    '충무로', '을지로', '퇴계로', '서울로',
    // 와/가/과 브랜드·진료과
    '다나와', '오키나와', '오메가', '산부인과', '정신과',
    // 이: 받침+이 보통명사
    '떡볶이', '쌍둥이',
    // 처럼: 브랜드
    '처음처럼',
    // 의(主義) 계열 — 구조적 가드(사전 미등록도 차단되어야 함)
    '민주주의', '자본주의', '개인주의', '권위주의', '민족주의', '자유주의',
  ];
  it.each(realWorld)('%s 는 그대로 유지된다', (word) => {
    expect(stripParticle(word)).toBe(word);
  });

  it("주(州) 지명은 보존하되 회사명+의는 정상 절단(구조적 가드 경계)", () => {
    expect(stripParticle('파주의')).toBe('파주의'); // 주(州) 어간 → 미절단(감수)
    expect(stripParticle('대한민국의')).toBe('대한민국'); // 주로 끝나지 않음 → 정상
  });
});

describe('stripParticle — 조사 없는 토큰 통과(passthrough)', () => {
  const passthrough = ['삼성', '네이버', '카카오', '갤럭시', '아이폰', 'toss', 'gpt', '2024년', '5g'];
  it.each(passthrough)('%s 는 변하지 않는다', (token) => {
    expect(stripParticle(token)).toBe(token);
  });
});
