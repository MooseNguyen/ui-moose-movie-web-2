'use client';

import { Component, type ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };
type State = { hasError: boolean };

/** Isolates a failing section so the rest of the page keeps rendering. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ui]', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
