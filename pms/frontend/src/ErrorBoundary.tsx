// Keeps one broken screen from taking the whole front desk down.
//
// Data-fetching errors are already handled well — `QueryState` renders a
// retryable panel. What was unhandled is a *render* error: an unexpected null,
// a data shape nobody anticipated, a chart given something it cannot draw.
// React's response to an uncaught error during render is to unmount the entire
// tree, so any one of the 24 screens could turn the whole application into a
// blank page mid-shift, recoverable only by a hard reload.
//
// For a tool somebody uses all day with a guest standing in front of them, that
// is the difference between "this screen is broken, use another one" and "the
// system is down". The boundary contains the failure to the screen that caused
// it and leaves the shell — navigation, search, everything else — working.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert, RotateCcw, House } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this resets the boundary — used to recover on navigation. */
  resetKey?: string;
  onGoHome?: () => void;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
  lastResetKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  /**
   * Recover when the user navigates away.
   *
   * Without this the boundary stays broken for the rest of the session: the
   * user clicks another screen, React reuses the same boundary, and they keep
   * seeing the error from a screen they have already left.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, info: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // Logged rather than swallowed. There is no error-tracking service wired up
    // yet, so the console is the only record — and a boundary that hides the
    // stack trace makes the bug behind it far harder to find.
    console.error('[helio] a screen failed to render', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-black/10 p-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-status-bad/10 flex items-center justify-center shrink-0">
              <TriangleAlert className="w-5 h-5 text-status-bad" />
            </div>
            <div>
              <p className="text-[16px] font-black mb-1">This screen could not be displayed</p>
              <p className="text-[12px] text-dash-muted leading-relaxed">
                Something in the data on this page was not what the screen expected. Nothing has
                been changed or lost — the rest of the system is still working, and you can carry
                on using it from the menu.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <button
              onClick={() => this.setState({ error: null, info: null })}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-xl bg-dash-text text-white">
              <RotateCcw className="w-3.5 h-3.5" />
              Try this screen again
            </button>
            {this.props.onGoHome && (
              <button
                onClick={() => { this.setState({ error: null, info: null }); this.props.onGoHome?.(); }}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-xl border border-black/10">
                <House className="w-3.5 h-3.5" />
                Go to the dashboard
              </button>
            )}
          </div>

          {/* Shown, not hidden behind a toggle nobody opens: whoever is on the
              phone to support needs to be able to read this out. */}
          <details open className="text-[11px]">
            <summary className="cursor-pointer font-bold text-dash-muted mb-2">
              What went wrong (for support)
            </summary>
            <pre className="bg-dash-bg rounded-xl p-3 overflow-x-auto scroll-thin whitespace-pre-wrap break-words text-[10px] leading-relaxed">
              {error.name}: {error.message}
              {info?.componentStack ? `\n${info.componentStack.split('\n').slice(0, 6).join('\n')}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
