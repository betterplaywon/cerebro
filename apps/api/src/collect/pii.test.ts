import { describe, expect, it } from 'vitest';
import { redactSensitive } from './pii.js';

const MASK = '●●●';

describe('redactSensitive', () => {
  it('주민등록번호를 마스킹한다(하이픈 유무 모두)', () => {
    expect(redactSensitive('홍길동 900101-1234567')).not.toContain('900101-1234567');
    expect(redactSensitive('9001011234567')).toBe(MASK);
  });

  it('외국인등록번호(성별코드 5~8)를 마스킹한다', () => {
    // 성별코드 5(1900년대 외국인)·7(2000년대 외국인) — 이전엔 [1-4]만 잡아 통과했다(실측).
    expect(redactSensitive('등록번호 900101-5234567')).not.toContain('900101-5234567');
    expect(redactSensitive('000101-7234567 입니다')).not.toContain('000101-7234567');
  });

  it('점 구분자 등록번호도 마스킹한다(날짜부 점 표기 습관 — 적대적 검증 발견 누출)', () => {
    // 한국어가 날짜를 점으로 쓰는 습관이 주민번호 표기로 이어진다. 이전엔 [-\s]만 잡아 누출.
    expect(redactSensitive('900101.1234567')).toBe(MASK);
    expect(redactSensitive('외국인 050101.8234567')).not.toContain('050101.8234567');
  });

  it('한글에 바로 붙은 등록번호도 마스킹한다(\\b가 한글 경계에서 동작)', () => {
    expect(redactSensitive('연락처900101-1234567참고')).not.toContain('900101-1234567');
  });

  it('이메일(연락처)을 마스킹한다', () => {
    expect(redactSensitive('문의 hong@test.com 으로')).not.toContain('hong@test.com');
    expect(redactSensitive('a.b+tag@sub.example.co.kr')).toBe(MASK);
  });

  it('휴대전화 번호를 마스킹한다(구분자 유무 모두)', () => {
    expect(redactSensitive('연락처 010-1234-5678')).not.toContain('010-1234-5678');
    expect(redactSensitive('01012345678 로 연락')).not.toContain('01012345678');
    expect(redactSensitive('문의 019.222.3333')).not.toContain('019.222.3333');
  });

  it('Luhn을 통과하는 신용카드 번호를 마스킹한다(공백·하이픈 구분자)', () => {
    expect(redactSensitive('카드 4111 1111 1111 1111 결제')).not.toContain('4111');
    expect(redactSensitive('4111-1111-1111-1111')).toBe(MASK);
  });

  it('16자리 외 길이(Amex 15자리)도 Luhn 통과 시 마스킹한다(길이밴드 13~19 보장)', () => {
    // 양성 케이스가 전부 16자리면 {12,18} 밴드가 16으로 좁혀져도 회귀가 안 잡힘 → 15자리로 고정.
    expect(redactSensitive('카드 3782 822463 10005')).not.toContain('3782');
  });

  it('@가 없는 긴 문자열도 빠르게 원문 반환한다(이메일 정규식 2차 백트래킹 차단)', () => {
    const long = 'a'.repeat(100_000);
    const start = performance.now();
    expect(redactSensitive(long)).toBe(long);
    expect(performance.now() - start).toBeLessThan(1000); // 선형이면 수 ms, 2차면 수 초
  });

  // ── 오탐(과탐) 저감 회귀 코퍼스: 아래는 모두 원문 그대로 유지되어야 한다 ──
  it('공개 대표 유선번호(02 등)는 건드리지 않는다', () => {
    const t = '토스는 핀테크 앱이다. 대표 02-1234-5678';
    expect(redactSensitive(t)).toBe(t);
  });

  it('Luhn을 통과하지 못하는 16자리(임의 코드)는 마스킹하지 않는다', () => {
    const code = '1234567890123456'; // Luhn 불통과
    expect(redactSensitive(`상품코드 ${code}`)).toBe(`상품코드 ${code}`);
  });

  it('긴 숫자 기사ID(Luhn 불통과 16자리)는 마스킹하지 않는다', () => {
    const articleId = '2024010112345678'; // Luhn 불통과
    expect(redactSensitive(articleId)).toBe(articleId);
  });

  it('날짜부가 무효한 13자리(MM=13)는 등록번호로 오탐하지 않는다', () => {
    const t = '코드 9913011234567'; // 13월 → 유효 날짜 아님
    expect(redactSensitive(t)).toBe(t);
  });

  it('PII 없는 정상 본문은 원문 그대로 유지한다', () => {
    const t = '삼성전자는 2024년 매출 300조를 기록했다. 신제품을 6월 26일 발표.';
    expect(redactSensitive(t)).toBe(t);
  });

  it('한 문자열에 섞인 여러 식별자를 모두 마스킹한다', () => {
    const out = redactSensitive('제보 hong@test.com, 010-1234-5678, 주민 900101-1234567');
    expect(out).not.toContain('hong@test.com');
    expect(out).not.toContain('010-1234-5678');
    expect(out).not.toContain('900101-1234567');
  });
});
