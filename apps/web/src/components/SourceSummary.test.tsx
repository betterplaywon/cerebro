import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Source, SourceType } from '@cerebro/shared';
import { SourceSummary } from './SourceSummary';

function mkSource(type: SourceType, id: string): Source {
  return {
    id,
    type,
    title: `${type} 제목`,
    url: `https://example.com/${id}`,
    collectedAt: '2026-06-26T00:00:00.000Z',
    confidence: 0.5,
  };
}

describe('SourceSummary', () => {
  it('분석된 출처 총 건수와 유형별 한글 배지를 표시한다', () => {
    render(
      <SourceSummary
        sources={[mkSource('wikipedia', '1'), mkSource('naver', '2'), mkSource('naver', '3')]}
      />,
    );
    expect(screen.getByText('분석된 출처 3건')).toBeInTheDocument();
    expect(screen.getByText('네이버')).toBeInTheDocument();
    expect(screen.getByText('위키백과')).toBeInTheDocument();
  });

  it('출처가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<SourceSummary sources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
