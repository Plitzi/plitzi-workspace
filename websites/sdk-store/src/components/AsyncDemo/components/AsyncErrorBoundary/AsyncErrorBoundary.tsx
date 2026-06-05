import { Component } from 'react';

import type { ReactNode } from 'react';

type Props = {
  // When this value changes, a caught error is cleared so the children can retry.
  resetKey: number;
  onRetry: () => void;
  children: ReactNode;
};

type State = { error: Error | null };

class AsyncErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-red-400">⚠ {error.message}</p>
          <button
            onClick={this.props.onRetry}
            className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-brand-500 hover:text-white"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AsyncErrorBoundary;
