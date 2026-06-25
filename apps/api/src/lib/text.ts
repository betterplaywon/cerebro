/** HTML 태그·엔티티를 제거해 표시용 평문으로 정리한다(검색 스니펫 공용). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x?[0-9a-f]+;/gi, ' ') // 기타 수치 엔티티 제거
    .replace(/&[a-z]+;/gi, ' ') // 기타 명명 엔티티 제거
    .replace(/\s+/g, ' ')
    .trim();
}
