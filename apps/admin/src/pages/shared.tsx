import { useOperatorSession } from "@/state/operator-session";
import { EmptyState } from "@/components/console/primitives";

export function useConfiguredSessionGuard() {
  const { configuredSession } = useOperatorSession();

  if (!configuredSession) {
    return {
      session: null,
      fallback: (
        <EmptyState
          title="Credentials required"
          description="Save an operator session to load queues, reconciliation workspaces, treasury visibility, and launch readiness evidence."
        />
      )
    };
  }

  return {
    session: configuredSession,
    fallback: null
  };
}
