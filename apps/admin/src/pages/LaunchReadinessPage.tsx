import { useQuery } from "@tanstack/react-query";
import {
  getReleaseReadinessSummary,
  listPendingReleases,
  listReleaseReadinessApprovals,
  listReleaseReadinessEvidence,
  listReleasedReleases
} from "@/lib/api";
import { formatCount, formatDateTime } from "@/lib/format";
import { MetricCard, SectionPanel } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function LaunchReadinessPage() {
  const { session, fallback } = useConfiguredSessionGuard();

  const releaseSummaryQuery = useQuery({
    queryKey: ["launch-release-summary", session?.baseUrl],
    queryFn: () => getReleaseReadinessSummary(session!),
    enabled: Boolean(session)
  });

  const evidenceQuery = useQuery({
    queryKey: ["launch-evidence", session?.baseUrl],
    queryFn: () => listReleaseReadinessEvidence(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const approvalsQuery = useQuery({
    queryKey: ["launch-approvals", session?.baseUrl],
    queryFn: () => listReleaseReadinessApprovals(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const pendingReleasesQuery = useQuery({
    queryKey: ["pending-releases", session?.baseUrl],
    queryFn: () => listPendingReleases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const releasedReleasesQuery = useQuery({
    queryKey: ["released-releases", session?.baseUrl],
    queryFn: () => listReleasedReleases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  if (fallback) {
    return fallback;
  }

  if (
    releaseSummaryQuery.isLoading ||
    evidenceQuery.isLoading ||
    approvalsQuery.isLoading ||
    pendingReleasesQuery.isLoading ||
    releasedReleasesQuery.isLoading
  ) {
    return <p>Loading launch readiness...</p>;
  }

  if (
    releaseSummaryQuery.isError ||
    evidenceQuery.isError ||
    approvalsQuery.isError ||
    pendingReleasesQuery.isError ||
    releasedReleasesQuery.isError
  ) {
    return <p>Failed to load launch readiness state.</p>;
  }

  const summary = releaseSummaryQuery.data!;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Launch readiness"
        description="Evidence posture, approvals, and release workflow state."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Required checks"
            value={formatCount(summary.summary.requiredCheckCount)}
            detail={`${formatCount(summary.summary.passedCheckCount)} passed`}
          />
          <MetricCard
            label="Approvals"
            value={formatCount(approvalsQuery.data!.approvals.length)}
            detail={`${formatCount(pendingReleasesQuery.data!.releases.length)} pending releases`}
          />
          <MetricCard
            label="Recorded evidence"
            value={formatCount(evidenceQuery.data!.evidence.length)}
            detail={`${formatCount(releasedReleasesQuery.data!.releases.length)} released artifacts`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Required evidence"
        description="Latest status for each launch gate check."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {summary.requiredChecks.map((check) => (
              <div key={check.evidenceType} className="admin-list-row">
                <strong>{check.label}</strong>
                <span>{check.status}</span>
                <span>{check.latestEvidence?.releaseIdentifier ?? "No release"}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Approval chain"
        description="Pending and completed governed release approvals."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Approvals</h3>
            <div className="admin-list">
              {approvalsQuery.data!.approvals.map((approval) => (
                <div key={approval.id} className="admin-list-row">
                  <strong>{approval.releaseIdentifier}</strong>
                  <span>{approval.status}</span>
                  <span>{formatDateTime(approval.requestedAt)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-list-card">
            <h3>Pending releases</h3>
            <div className="admin-list">
              {pendingReleasesQuery.data!.releases.map((release) => (
                <div key={release.id} className="admin-list-row">
                  <strong>{release.customer.email}</strong>
                  <span>{release.status}</span>
                  <span>{release.releaseTarget}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
