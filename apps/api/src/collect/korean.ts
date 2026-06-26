/**
 * 한국어 조사(助詞) 휴리스틱 — 키워드 토큰 끝의 흔한 조사를 떼어
 * 같은 개체의 토큰 파편화를 막는다(토스가/토스는/토스를/토스의 → 토스).
 *
 * 형태소 분석기를 도입하지 않은 의존성 0 규칙 기반이다(트레이드오프는 ADR-0004).
 * 핵심 안전장치는 한국어 조사의 **받침(종성) 이형태** 규칙이다:
 *  - 모음형 조사(가/는/를/와)는 모음으로 끝난 어간 뒤에만,
 *  - 자음형 조사(이/은/을/과)는 자음으로 끝난 어간 뒤에만 결합한다.
 * 이 규칙만으로 음악가·국가·물가·대학가·누군가(받침 뒤 '가')의 오절단을 사전 없이 차단한다.
 * 받침으로 못 거르는 잔여 오탐(어린이·민주주의·제주도 등)은 최소 어간 길이(2) +
 * 좁은 보호 단어 사전으로 막는다.
 */

/** 조사가 결합할 수 있는 어간 말음 조건. */
type Allomorph = 'vowel' | 'consonant' | 'any' | 'rieulOrVowel';

/** 받침 없음(모음 종결)의 종성 인덱스. */
const NO_JONGSEONG = 0;
/** ㄹ 받침의 종성 인덱스. */
const RIEUL_JONGSEONG = 8;

/** 어간 최소 길이(음절). 미만이면 절단하지 않는다(국가→국, 물가→물 방지). */
const MIN_STEM_LENGTH = 2;

/**
 * 문자열 마지막 음절의 종성(받침) 인덱스를 돌려준다.
 *  - 0  = 받침 없음(모음 종결)
 *  - 8  = ㄹ 받침
 *  - 그 외 = 일반 자음 종결
 * 완성형 한글(U+AC00–U+D7A3) 음절이 아니면 null(영문·숫자 혼합 토큰 보호용).
 */
export function lastJongseong(s: string): number | null {
  const code = s.charCodeAt(s.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28;
}

/** 조사 후보. 긴 것부터 시도해 과분할을 막는다('으로'를 '로'보다 먼저). */
const PARTICLES: ReadonlyArray<readonly [suffix: string, requires: Allomorph]> = [
  // 3음절 결합형 — 가장 먼저 매칭
  ['에서는', 'any'], ['에서도', 'any'], ['에서의', 'any'],
  ['으로는', 'consonant'], ['으로도', 'consonant'], ['으로서', 'consonant'], ['으로써', 'consonant'],
  ['에게서', 'any'], ['이라는', 'consonant'], ['이라고', 'consonant'],
  // 2음절
  ['에서', 'any'], ['에게', 'any'], ['한테', 'any'], ['께서', 'any'],
  ['으로', 'consonant'], ['보다', 'any'], ['처럼', 'any'], ['까지', 'any'],
  ['부터', 'any'], ['마다', 'any'], ['조차', 'any'], ['마저', 'any'], ['밖에', 'any'],
  ['라는', 'vowel'], ['라고', 'vowel'],
  // 1음절 — 주요 파편 유발자
  ['은', 'consonant'], ['는', 'vowel'], ['이', 'consonant'], ['가', 'vowel'],
  ['을', 'consonant'], ['를', 'vowel'], ['과', 'consonant'], ['와', 'vowel'],
  ['로', 'rieulOrVowel'], ['의', 'any'], ['에', 'any'], ['도', 'any'], ['만', 'any'],
];

/**
 * 받침·길이 가드를 통과하지만 조사처럼 보이는 말음을 가진 실제 단어들.
 * 받침 이형태 규칙으로 못 거르는 잔여 오탐을 막는 사전(알려진·비완전 유지보수 대상).
 * 받침+조사동음 말음을 가진 고유명사/보통명사는 열린 집합이라 사전은 **자주 검색되는
 * 고가치 항목 위주**로 큐레이션한다(개방 클래스 한계는 ADR-0004). '주의(主義)' 계열은
 * 사전 대신 `stripParticle`의 구조적 가드로 일괄 차단한다.
 */
const PROTECTED_WORDS: ReadonlySet<string> = new Set([
  // 이(자음 어간): 받침+이 보통명사
  '어린이', '고양이', '호랑이', '원숭이', '떡볶이', '쌍둥이',
  // 도(道/島): 행정구역·섬·지구
  '제주도', '경기도', '강원도', '충청도', '전라도', '경상도', '함경도', '평안도', '황해도',
  '여의도', '울릉도', '거제도', '강화도', '영종도', '안면도', '마라도', '백령도', '선유도', '흑산도',
  // 로(路): 거리·역명 (받침/모음 어간)
  '충무로', '을지로', '퇴계로', '서울로',
  // 와(브랜드·지명) / 가(모음 어간 '~家' 직업명·브랜드)
  '다나와', '오키나와', '만화가', '정치가', '애호가', '애주가', '작사가', '안무가', '오메가',
  // 과(科): 진료과·학과
  '산부인과', '정신과', '신경과',
  // 처럼(브랜드)
  '처음처럼',
]);

function satisfiesAllomorph(jongseong: number, requires: Allomorph): boolean {
  switch (requires) {
    case 'any':
      return true;
    case 'vowel':
      return jongseong === NO_JONGSEONG;
    case 'consonant':
      return jongseong !== NO_JONGSEONG;
    case 'rieulOrVowel':
      return jongseong === NO_JONGSEONG || jongseong === RIEUL_JONGSEONG;
  }
}

/**
 * 토큰 끝의 조사 한 개를 떼어 어간을 돌려준다.
 * 조사가 없거나 가드를 통과하지 못하면 원래 토큰을 그대로 돌려준다.
 * 가장 긴 조사를 먼저 매칭하고 한 번만 절단한다(재귀 절단에 의한 과침식 방지).
 */
export function stripParticle(token: string): string {
  if (PROTECTED_WORDS.has(token)) return token;
  for (const [suffix, requires] of PARTICLES) {
    if (!token.endsWith(suffix)) continue;
    const stem = token.slice(0, -suffix.length);
    if (stem.length < MIN_STEM_LENGTH) continue;
    // '주의(主義)' 계열 구조적 가드: '의'를 떼면 민주주의·자본주의·개인주의가 '…주'로 깨진다.
    // 'X주'로 끝나는 어간 앞 '의'는 떼지 않는다(주(州) 지명+의 소수 미절단은 감수).
    if (suffix === '의' && stem.endsWith('주')) continue;
    const jongseong = lastJongseong(stem);
    // 어간이 완성형 한글로 끝나지 않으면(영문·숫자 혼합) 손대지 않는다.
    if (jongseong === null) continue;
    if (!satisfiesAllomorph(jongseong, requires)) continue;
    return stem;
  }
  return token;
}
