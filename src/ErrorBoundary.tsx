// Top-level safety net. Without this, a crash anywhere in the React
// tree (Board SVG, AI worker callback, a Supabase row that came back
// in an unexpected shape) takes down the whole UI to a blank page —
// the user can't tell whether the app is loading, frozen, or dead.
//
// Class component because React still requires getDerivedStateFromError
// / componentDidCatch on a class for error boundaries.

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to the console so we have something to copy-paste during
    // triage. Future enhancement: pipe to Sentry / similar.
    console.error('[error-boundary]', error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <h2 className="error-boundary-title">Something broke.</h2>
          <p className="error-boundary-msg">
            Skyflag hit an unexpected error. Your local game is saved — a
            reload usually clears it.
          </p>
          <pre className="error-boundary-trace">{this.state.error.message}</pre>
          <div className="error-boundary-actions">
            <button type="button" className="hud-btn" onClick={this.reload}>
              Reload
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-subtle"
              onClick={this.reset}
            >
              Try again without reloading
            </button>
          </div>
        </div>
      </div>
    );
  }
}
