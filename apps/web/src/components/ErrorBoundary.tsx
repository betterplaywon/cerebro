import { Component, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 로딩 연출용 에러 경계. lazy 청크 로드 실패·WebGL 미지원 등으로 시네마틱 씬이 던지면
 * fallback(가벼운 CSS 셸)으로 대체한다 — 로더의 시각 실패가 앱 전체를 무너뜨리지 않게.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    // 의도적으로 삼킨다: 로더는 비핵심 시각 요소이며 폴백으로 이미 복구된다.
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
