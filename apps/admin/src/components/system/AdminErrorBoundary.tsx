import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "@/i18n/use-t";
import { adminTelemetry } from "@/lib/observability";

type AdminErrorBoundaryProps = {
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string;
  readonly children: ReactNode;
};

type AdminErrorBoundaryState = {
  readonly hasError: boolean;
};

class AdminErrorBoundaryInner extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    adminTelemetry.captureException(error, {
      message: "Operator console runtime boundary triggered",
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
      <div className="admin-app-shell">
        <div className="admin-shell-frame" style={{ minHeight: "100vh" }}>
          <div className="admin-stage admin-stage-panel" style={{ margin: "auto" }}>
            <div className="admin-header-block">
              <p className="admin-eyebrow">Operator console recovery</p>
              <h1>{this.props.title}</h1>
              <p className="admin-copy">{this.props.message}</p>
            </div>
            <button className="admin-button" onClick={this.reload} type="button">
              {this.props.actionLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export function AdminErrorBoundary({
  children
}: {
  readonly children: ReactNode;
}) {
  const t = useT();

  return (
    <AdminErrorBoundaryInner
      actionLabel={t("misc.reload")}
      message={t("misc.runtimeErrorDescription")}
      title={t("misc.runtimeErrorTitle")}
    >
      {children}
    </AdminErrorBoundaryInner>
  );
}
