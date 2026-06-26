import type { NodeKind } from '@cerebro/shared';

/**
 * 카테고리별 식별 아이콘. 색맹·저대비 환경에서도 색에 의존하지 않도록 **형태로 구분**한다
 * (DESIGN-SYSTEM §1.4 "색+아이콘+라벨"). `currentColor`를 쓰므로 부모가 카테고리 색을 지정.
 */
export function CategoryIcon({ kind, size = 14 }: { kind: NodeKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'center': // 동심원
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'product': // 큐브
      return (
        <svg {...common}>
          <path d="M8 2l5 3v6l-5 3-5-3V5z" />
          <path d="M8 2v3M3 5l5 3 5-3M8 8v6" />
        </svg>
      );
    case 'news': // 신문/삼각
      return (
        <svg {...common}>
          <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
          <path d="M5 6h4M5 8.5h4M5 11h2.5M11 6v5" />
        </svg>
      );
    case 'person': // 인물
      return (
        <svg {...common}>
          <circle cx="8" cy="5.5" r="2.6" />
          <path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        </svg>
      );
    case 'channel': // 링크/공유
      return (
        <svg {...common}>
          <circle cx="4.5" cy="8" r="2" />
          <circle cx="11.5" cy="4" r="2" />
          <circle cx="11.5" cy="12" r="2" />
          <path d="M6.3 7l3.4-2M6.3 9l3.4 2" />
        </svg>
      );
    case 'reputation': // 별
      return (
        <svg {...common}>
          <path d="M8 2.2l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11l-3.4 1.7.7-3.8-2.8-2.7 3.8-.5z" />
        </svg>
      );
    case 'attribute': // 점
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3.2" />
        </svg>
      );
    case 'usage': // 전구(활용 관점)
      return (
        <svg {...common}>
          <path d="M8 1.8a4.2 4.2 0 0 0-2.6 7.6c.5.4.8 1 .8 1.6h3.6c0-.6.3-1.2.8-1.6A4.2 4.2 0 0 0 8 1.8z" />
          <path d="M6.4 13.2h3.2M6.9 14.6h2.2" />
        </svg>
      );
    case 'concept': // 태그/해시
    default:
      return (
        <svg {...common}>
          <path d="M6 2.5L4.5 13.5M11.5 2.5L10 13.5M3 6h11M2.5 10h11" />
        </svg>
      );
  }
}
