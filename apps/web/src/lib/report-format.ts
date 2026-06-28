/** 문단당 묶을 문장 수(줄바꿈 없는 본문을 문장 기준으로 나눌 때). */
const SENTENCES_PER_PARAGRAPH = 2;

/**
 * 리포트 본문을 문단 배열로 분해한다.
 * 1순위: LLM이 넣은 빈 줄(개행) 기준 — 논리 단위 문단을 그대로 존중.
 * 폴백: 개행이 전혀 없는 한 덩어리(기존 캐시·개행 미준수 응답)면 문장 단위로 묶어 가독성 확보.
 */
export function reportParagraphs(report: string): string[] {
  const byNewline = report
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byNewline.length > 1) return byNewline;
  return groupSentences(byNewline[0] ?? '');
}

/**
 * 한 덩어리 텍스트를 문장 종결부호(. ! ? 。) + 공백 기준으로 끊어 N문장씩 묶는다.
 * 종결부호 뒤 공백만 끊으므로 소수점("3.5조")은 분리되지 않는다. 2문장 이하면 분리하지 않는다.
 */
function groupSentences(text: string): string[] {
  if (!text) return [];
  const sentences = text
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length <= SENTENCES_PER_PARAGRAPH) return [text];

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(' '));
  }
  return paragraphs;
}
