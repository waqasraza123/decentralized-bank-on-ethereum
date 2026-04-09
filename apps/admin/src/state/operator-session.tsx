import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { OperatorSession } from "@/lib/types";

export const operatorSessionStorageKey = "stealth-trails-bank.admin.operator-session";

export type SessionDraft = OperatorSession;

type OperatorSessionContextValue = {
  sessionDraft: SessionDraft;
  configuredSession: OperatorSession | null;
  setSessionDraft: React.Dispatch<React.SetStateAction<SessionDraft>>;
  saveSession: () => void;
};

const OperatorSessionContext = createContext<OperatorSessionContextValue | null>(null);

function loadStoredSession(serverUrl: string): SessionDraft {
  if (typeof window === "undefined") {
    return {
      baseUrl: serverUrl,
      operatorId: "",
      operatorRole: "operations_admin",
      apiKey: ""
    };
  }

  const serializedSession = window.localStorage.getItem(operatorSessionStorageKey);

  if (!serializedSession) {
    return {
      baseUrl: serverUrl,
      operatorId: "",
      operatorRole: "operations_admin",
      apiKey: ""
    };
  }

  try {
    const parsedSession = JSON.parse(serializedSession) as Partial<SessionDraft>;

    return {
      baseUrl: parsedSession.baseUrl || serverUrl,
      operatorId: parsedSession.operatorId || "",
      operatorRole: parsedSession.operatorRole || "operations_admin",
      apiKey: parsedSession.apiKey || ""
    };
  } catch {
    return {
      baseUrl: serverUrl,
      operatorId: "",
      operatorRole: "operations_admin",
      apiKey: ""
    };
  }
}

function persistSession(session: SessionDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(operatorSessionStorageKey, JSON.stringify(session));
}

export function OperatorSessionProvider({
  serverUrl,
  children
}: {
  serverUrl: string;
  children: ReactNode;
}) {
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() =>
    loadStoredSession(serverUrl)
  );

  const value = useMemo<OperatorSessionContextValue>(() => {
    const configuredSession =
      sessionDraft.operatorId.trim() && sessionDraft.apiKey.trim()
        ? sessionDraft
        : null;

    return {
      sessionDraft,
      configuredSession,
      setSessionDraft,
      saveSession: () => persistSession(sessionDraft)
    };
  }, [sessionDraft]);

  return (
    <OperatorSessionContext.Provider value={value}>
      {children}
    </OperatorSessionContext.Provider>
  );
}

export function useOperatorSession() {
  const context = useContext(OperatorSessionContext);

  if (!context) {
    throw new Error("useOperatorSession must be used within OperatorSessionProvider.");
  }

  return context;
}
