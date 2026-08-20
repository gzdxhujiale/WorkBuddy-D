import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "@/lib/syncEngine";

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

/** Makes render-time failures recoverable and visible instead of a blank window. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("AppErrorBoundary", "Unhandled render error", { error, info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-semibold">页面出现异常</h1>
          <p className="text-sm text-muted-foreground">
            该页面未能正常渲染。请刷新应用；若问题持续出现，请联系支持并附上复现步骤。
          </p>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            刷新应用
          </button>
        </section>
      </main>
    );
  }
}
