import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getAccountHoldSummary,
  getOversightIncidentWorkspace,
  listActiveAccountHolds,
  listOversightIncidents
} from "@/lib/api";
import { formatName, shortenValue, toTitleCase } from "@/lib/format";
import { EmptyState, SectionPanel } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function AccountsPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIncidentId = searchParams.get("incident");

  const incidentsQuery = useQuery({
    queryKey: ["oversight-incidents", session?.baseUrl],
    queryFn: () => listOversightIncidents(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const activeAccountHoldsQuery = useQuery({
    queryKey: ["active-account-holds", session?.baseUrl],
    queryFn: () => listActiveAccountHolds(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const accountHoldSummaryQuery = useQuery({
    queryKey: ["account-hold-summary", session?.baseUrl],
    queryFn: () => getAccountHoldSummary(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const workspaceQuery = useQuery({
    queryKey: ["oversight-workspace", session?.baseUrl, selectedIncidentId],
    queryFn: () => getOversightIncidentWorkspace(session!, selectedIncidentId!, 8),
    enabled: Boolean(session && selectedIncidentId)
  });

  useEffect(() => {
    const firstId = incidentsQuery.data?.oversightIncidents[0]?.id;
    if (firstId && !selectedIncidentId) {
      setSearchParams({ incident: firstId });
    }
  }, [incidentsQuery.data, selectedIncidentId, setSearchParams]);

  if (fallback) {
    return fallback;
  }

  if (
    incidentsQuery.isLoading ||
    activeAccountHoldsQuery.isLoading ||
    accountHoldSummaryQuery.isLoading
  ) {
    return <p>Loading account workspaces...</p>;
  }

  if (
    incidentsQuery.isError ||
    activeAccountHoldsQuery.isError ||
    accountHoldSummaryQuery.isError
  ) {
    return <p>Failed to load account review data.</p>;
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Accounts and reviews"
        description="Customer restrictions, incident context, and active holds."
      >
        <div className="admin-split-layout">
          <div className="admin-list-card">
            <h3>Incidents</h3>
            <div className="admin-list">
              {incidentsQuery.data!.oversightIncidents.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  className={`admin-list-row selectable ${
                    selectedIncidentId === incident.id ? "selected" : ""
                  }`}
                  onClick={() => setSearchParams({ incident: incident.id })}
                >
                  <strong>
                    {formatName(
                      incident.subjectCustomer.firstName,
                      incident.subjectCustomer.lastName
                    )}
                  </strong>
                  <span>{toTitleCase(incident.status)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-list-card">
            <h3>Workspace</h3>
            {workspaceQuery.data ? (
              <div className="admin-detail-stack">
                <p>
                  <strong>Incident:</strong> {workspaceQuery.data.oversightIncident.id}
                </p>
                <p>
                  <strong>Restriction active:</strong>{" "}
                  {workspaceQuery.data.accountRestriction.active ? "Yes" : "No"}
                </p>
                <p>
                  <strong>Recent review cases:</strong>{" "}
                  {workspaceQuery.data.recentReviewCases.length}
                </p>
                <p>
                  <strong>Hold governance:</strong>{" "}
                  {workspaceQuery.data.accountHoldGovernance.canApplyAccountHold
                    ? "Can apply"
                    : "Read only"}
                </p>
              </div>
            ) : (
              <EmptyState
                title="Select an incident"
                description="Choose an incident to inspect restriction state and linked review activity."
              />
            )}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Active account holds"
        description="Current restrictions and recent hold posture."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Summary</h3>
            <p className="admin-copy">
              Open holds: {accountHoldSummaryQuery.data?.activeHolds ?? 0}
            </p>
          </div>
          <div className="admin-list-card">
            <h3>Recent holds</h3>
            <div className="admin-list">
              {activeAccountHoldsQuery.data!.holds.map((hold) => (
                <div key={hold.hold.id} className="admin-list-row">
                  <strong>{hold.customer.email ?? "Not available"}</strong>
                  <span>{hold.hold.restrictionReasonCode}</span>
                  <span>{shortenValue(hold.oversightIncident.id)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
