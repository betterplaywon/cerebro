import { describe, expect, it } from 'vitest';
import { reportParagraphs } from './report-format';

describe('reportParagraphs', () => {
  it('LLM이 넣은 빈 줄(개행)을 문단 경계로 존중한다', () => {
    const report = '첫 문단.\n\n둘째 문단.\n\n셋째 문단.';
    expect(reportParagraphs(report)).toEqual(['첫 문단.', '둘째 문단.', '셋째 문단.']);
  });

  it('개행이 없는 긴 한 덩어리는 문장 단위(2문장)로 묶어 문단화한다', () => {
    const report = '문장 하나다. 문장 둘이다. 문장 셋이다. 문장 넷이다.';
    expect(reportParagraphs(report)).toEqual([
      '문장 하나다. 문장 둘이다.',
      '문장 셋이다. 문장 넷이다.',
    ]);
  });

  it('2문장 이하 짧은 본문은 분리하지 않는다(과분할 방지)', () => {
    const report = '짧은 요약이다. 한 줄 더 있다.';
    expect(reportParagraphs(report)).toEqual([report]);
  });

  it('소수점은 문장 경계로 오인하지 않는다(종결부호+공백만 분리)', () => {
    const report = '매출은 3.5조 원이다. 전년 대비 성장했다. 추가 투자가 예상된다.';
    expect(reportParagraphs(report)).toEqual([
      '매출은 3.5조 원이다. 전년 대비 성장했다.',
      '추가 투자가 예상된다.',
    ]);
  });

  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(reportParagraphs('')).toEqual([]);
  });
});
