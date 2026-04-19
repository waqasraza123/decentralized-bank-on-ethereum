export const adminMessages = {
  locale: {
    switcherLabel: "Language",
    english: "English",
    arabic: "العربية"
  },
  hero: {
    eyebrow: "Stealth Trails Bank",
    title: "Operator Console",
    description:
      "Internal review queues, oversight incidents, account holds, and governed incident package release workflows in one surface.",
    sessionActive: "Operator session active",
    credentialsRequired: "Credentials required",
    baseUrl: "Base URL"
  },
  flash: {
    updated: "Updated.",
    blocked: "Blocked."
  },
  credentials: {
    kicker: "Operator Credentials",
    title: "Local session",
    description:
      "The operator console now authenticates with a Supabase bearer token. Only the API base URL is kept in local storage; the current access token is session-scoped and operator identity is resolved by the API.",
    apiBaseUrl: "API Base URL",
    operatorAccessToken: "Operator Access Token",
    saveSession: "Save Session",
    clearSession: "Clear Session"
  },
  sections: {
    alertDelivery: "Alert Delivery",
    deliveryTargetHealth: "Delivery target health",
    releaseReadinessEvidence: "Release readiness evidence",
    platformHealth: "Platform health",
    treasuryVisibility: "Treasury visibility",
    ledgerReconciliation: "Ledger reconciliation",
    platformAuditLog: "Platform audit log",
    routeCriticalAlerts: "Route critical alerts"
  },
  misc: {
    notAvailable: "Not available",
    unknown: "Unknown",
    open: "Open",
    unnamedSubject: "Unnamed subject"
  }
} as const;

export type AdminMessages = typeof adminMessages;
