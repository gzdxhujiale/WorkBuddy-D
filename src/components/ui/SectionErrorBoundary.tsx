import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "@/lib/syncEngine";
import { Button } from "./button";

interface SectionErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  className?: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in sub-sections/widgets so a localized crash does not blank the entire app.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("SectionErrorBoundary", "Localized section render error", {
      error,
      info,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      fallbackTitle = "区域加载出错",
      fallbackMessage = "该功能模块遇到错误，无法正常显示。",
      className = "",
    } = this.props;

    return (
      <div
        className={`flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 text-foreground ${className}`}
      >
        <div className="text-destructive font-medium text-sm mb-1">{fallbackTitle}</div>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm">
          {this.state.error?.message || fallbackMessage}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={this.handleReset}
          className="text-xs h-7 px-3"
        >
          重新尝试
        </Button>
      </div>
    );
  }
}
