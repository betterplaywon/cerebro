import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GraphNode, GraphSnapshot } from '@cerebro/shared';
import { DetailPanel } from './DetailPanel';

const node: GraphNode = {
  id: 'cat-product',
  label: '제품',
  kind: 'product',
  importance: 0.8,
  confidence: 0.7,
  sourceIds: [],
};

const graph: GraphSnapshot = {
  subject: { id: 'subject-1', query: 'q', type: 'unknown', displayName: 'q' },
  nodes: [node],
  edges: [],
  sources: [],
  generatedAt: '2026-06-26T00:00:00.000Z',
};

describe('DetailPanel', () => {
  it('닫기 버튼을 누르면 onClose를 호출한다', () => {
    const onClose = vi.fn();
    render(<DetailPanel node={node} graph={graph} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc 키로 닫는다(a11y)', () => {
    const onClose = vi.fn();
    render(<DetailPanel node={node} graph={graph} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('열리면 닫기 버튼으로 포커스를 옮긴다(a11y)', () => {
    render(<DetailPanel node={node} graph={graph} onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByLabelText('닫기'));
  });
});
