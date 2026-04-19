import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "@/i18n/use-t";
import { webTelemetry } from "@/lib/observability";

type WebErrorBoundaryProps = {
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string;
  readonly children: ReactNode;
};

type WebErrorBoundaryState = {
  readonly hasError: boolean;
};

class WebErrorBoundaryInner extends Component<
  WebErrorBoundaryProps,
  WebErrorBoundaryState
> {
  state: WebErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    webTelemetry.captureException(error, {
      message: "Customer web runtime boundary triggered",
      context: {
        componentStack: errorInfo.componentStack,
        route:
          typeof globalThis.location === "undefined"
            ? null
            : globalThis.location.pathname
      }
    });
  }

  private reload = () => {
    if (typeof globalThis.location !== "undefined") {
      globalThis.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="stb-panel-shell w-full max-w-lg p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-rose-100 shadow-[0_0_0_16px_rgba(225,29,72,0.08)]" />
          <h1 className="mt-6 text-2xl font-semibold text-foreground">
            {this.props.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {this.props.message}
          </p>
          <button
            className="mt-6 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:-translate-y-0.5"
            onClick={this.reload}
            type="button"
          >
            {this.props.actionLabel}
          </button>
        </div>
      </div>
    );
  }
}

export function WebErrorBoundary({ children }: { readonly children: ReactNode }) {
  const t = useT();

  return (
    <WebErrorBoundaryInner
      actionLabel={t("app.reloadAction")}
      message={t("app.runtimeErrorDescription")}
      title={t("app.runtimeErrorTitle")}
    >
      {children}
    </WebErrorBoundaryInner>
  );
}
