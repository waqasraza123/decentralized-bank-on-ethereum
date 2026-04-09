import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getLedgerReconciliationWorkspace,
  listLedgerReconciliationMismatches,
  listLedgerReconciliationRuns
} from "@/lib/api";
import { formatDateTime, formatName, shortenValue, toTitleCase } from "@/lib/format";
import { EmptyState, SectionPanel } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function ReconciliationPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMismatchId = searchParams.get("mismatch");

  const mismatchesQuery = useQuery({
    queryKey: ["ledger-mismatches", session?.baseUrl],
    queryFn: () => listLedgerReconciliationMismatches(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const runsQuery = useQuery({
    queryKey: ["ledger-runs", session?.baseUrl],
    queryFn: () => listLedgerReconciliationRuns(session!, { limit: 10 }),
    enabled: Boolean(session)
  });

  const workspaceQuery = useQuery({
    queryKey: ["ledger-workspace", session?.baseUrl, selectedMismatchId],
    queryFn: () => getLedgerReconciliationWorkspace(session!, selectedMismatchId!, 10),
    enabled: Boolean(session && selectedMismatchId)
  });

  useEffect(() => {
    const firstId = mismatchesQuery.data?.mismatches[0]?.id;
    if (firstId && !selectedMismatchId) {
      setSearchParams({ mismatch: firstId });
    }
  }, [mismatchesQuery.data, selectedMismatchId, setSearchParams]);

  if (fallback) {
    return fallback;
  }

  if (mismatchesQuery.isLoading || runsQuery.isLoading) {
    return <p>Loading reconciliation workspaces...</p>;
  }

  if (mismatchesQuery.isError || runsQuery.isError) {
    return <p>Failed to load reconciliation data.</p>;
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Reconciliation"
        description="Mismatch review, scan history, and the currently selected repair workspace."
      >
        <div className="admin-split-layout">
          <div className="admin-list-card">
            <h3>Mismatches</h3>
            <div className="admin-list">
              {mismatchesQuery.data!.mismatches.map((mismatch) => (
                <button
                  key={mismatch.id}
                  type="button"
                  className={`admin-list-row selectable ${
                    selectedMismatchId === mismatch.id ? "selected" : ""
                  }`}
                  onClick={() => setSearchParams({ mismatch: mismatch.id })}
                >
                  <strong>{mismatch.summary}</strong>
                  <span>{toTitleCase(mismatch.status)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-list-card">
            <h3>Selected mismatch</h3>
            {workspaceQuery.data ? (
              <div className="admin-detail-stack">
                <p>
                  <strong>Mismatch:</strong> {workspaceQuery.data.mismatch.id}
                </p>
                <p>
                  <strong>Customer:</strong>{" "}
                  {workspaceQuery.data.mismatch.customer
                    ? formatName(
                        workspaceQuery.data.mismatch.customer.firstName,
                        workspaceQuery.data.mismatch.customer.lastName
                      )
                    : "Not available"}
                </p>
                <p>
                  <strong>Severity:</strong> {toTitleCase(workspaceQuery.data.mismatch.severity)}
                </p>
                <p>
                  <strong>Recommended action:</strong>{" "}
                  {toTitleCase(workspaceQuery.data.mismatch.recommendedAction)}
                </p>
              </div>
            ) : (
              <EmptyState
                title="Select a mismatch"
                description="Choose a mismatch to inspect evidence, audit events, and the recommended repair path."
              />
            )}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Recent scan runs"
        description="Latest reconciliation scans and their execution state."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {runsQuery.data!.runs.map((run) => (
              <div key={run.id} className="admin-list-row">
                <strong>{shortenValue(run.id)}</strong>
                <span>{toTitleCase(run.status)}</span>
                <span>{formatDateTime(run.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
