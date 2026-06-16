import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered when a descendant throws. Receives the error and a reset callback. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Optional hook invoked when an error is caught. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Optional hook invoked when the boundary is reset. */
  onReset?: () => void;
  /**
   * When this value changes while an error is shown, the boundary auto-resets.
   * Lets callers clear the error on, e.g., a route change WITHOUT remounting
   * children on every navigation.
   */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic React error boundary. Catches render/lifecycle errors thrown by
 * descendants and shows a fallback instead of white-screening the app.
 *
 * Logging is dev-only and never serializes props/state, so decrypted vault
 * data can't leak into logs. Boundaries do NOT catch errors in event handlers,
 * async code, or the boundary itself — see the design spec.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // Error + component stack only — never props/state (avoids leaking
      // decrypted credential data per the no-sensitive-logging rule).
      console.error('[ErrorBoundary] caught error:', error, info.componentStack);
    }
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Auto-clear the error when the resetKey changes (e.g. route navigation),
    // without remounting children during normal, error-free rendering.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
