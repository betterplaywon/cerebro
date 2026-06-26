import { describe, expect, it } from 'vitest';
import { redactSensitive } from './pii.js';

describe('redactSensitive', () => {
  it('주민등록번호를 마스킹한다(하이픈 유무 모두)', () => {
    expect(redactSensitive('홍길동 900101-1234567')).not.toContain('900101-1234567');
    expect(redactSensitive('9001011234567')).toBe('●●●');
  });

  it('휴대전화 번호를 마스킹한다(구분자 유무 모두)', () => {
    expect(redactSensitive('연락처 010-1234-5678')).not.toContain('010-1234-5678');
    expect(redactSensitive('01012345678 로 연락')).not.toContain('01012345678');
    expect(redactSensitive('문의 019.222.3333')).not.toContain('019.222.3333');
  });

  it('일반 텍스트와 공개 대표번호(02 등 유선)는 건드리지 않는다', () => {
    const t = '토스는 핀테크 앱이다. 대표 02-1234-5678';
    expect(redactSensitive(t)).toBe(t);
  });
});
