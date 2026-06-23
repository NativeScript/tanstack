import { Component, createElement } from 'react';
import type { ReactNode } from 'react';

interface RouteErrorBoundaryProps {
  // Render fallback for a caught error. Returning null renders nothing (used to
  // swallow expected backstack errors on hidden pages — see PageRenderer).
  fallback: (error: unknown, reset: () => void) => ReactNode;
  // Optional in the type so children can be passed as createElement's variadic
  // args; always present at runtime.
  children?: ReactNode;
}

interface RouteErrorBoundaryState {
  error: unknown;
}

/**
 * React analog of solid's `<ErrorBoundary>` for the per-page route tree.
 * Backstack pages can briefly evaluate stale route hooks while hidden; the
 * PageRenderer fallback swallows those expected errors by rendering null.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error != null) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
