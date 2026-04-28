import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveRelease,
  createIncidentPackageReleaseRequest,
  getGovernedIncidentPackageExport,
  getIncidentPackage,
  getRelease,
  listPendingReleases,
  listReleasedReleases,
  rejectRelease,
  releaseApprovedPackage
} from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  formatName,
  readApiErrorMessage,
  shortenValue,
  toTitleCase,
  trimToUndefined
} from "@/lib/format";
import type {
  GovernedIncidentPackageExport,
  IncidentPackageRelease,
  IncidentPackageSnapshot
} from "@/lib/types";
import {
  ActionRail,
  AdminStatusBadge,
  DetailList,
  EmptyState,
  ErrorState,
  InlineNotice,
  ListCard,
  LoadingState,
  MetricCard,
  PendingLabel,
  SectionPanel,
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

const incidentPackageExportModes = [
  "internal_full",
  "redaction_ready",
  "compliance_focused"
] as const;

const incidentPackageReleaseTargets = [
  "internal_casefile",
  "compliance_handoff",
  "regulator_response",
  "external_counsel"
] as const;

type IncidentPackageScopeDraft = {
  customerAccountId: string;
  supabaseUserId: string;
  mode: (typeof incidentPackageExportModes)[number];
  recentLimit: string;
  timelineLimit: string;
  sinceDays: string;
};

type IncidentPackageReleaseRequestDraft = {
  releaseTarget: (typeof incidentPackageReleaseTargets)[number];
  releaseReasonCode: string;
  requestNote: string;
};

function createScopeDraft(
  overrides: Partial<IncidentPackageScopeDraft> = {}
): IncidentPackageScopeDraft {
  return {
    customerAccountId: "",
    supabaseUserId: "",
    mode: "compliance_focused",
    recentLimit: "12",
    timelineLimit: "40",
    sinceDays: "30",
    ...overrides
  };
}

function createReleaseRequestDraft(
  overrides: Partial<IncidentPackageReleaseRequestDraft> = {}
): IncidentPackageReleaseRequestDraft {
  return {
    releaseTarget: "compliance_handoff",
    releaseReasonCode: "compliance_review_request",
    requestNote: "",
    ...overrides
  };
}

function parsePositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function hasIncidentPackageScope(scope: IncidentPackageScopeDraft): boolean {
  return (
    scope.customerAccountId.trim().length > 0 ||
    scope.supabaseUserId.trim().length > 0
  );
}

function buildIncidentPackageParams(scope: IncidentPackageScopeDraft) {
  return {
    customerAccountId: trimToUndefined(scope.customerAccountId),
    supabaseUserId: trimToUndefined(scope.supabaseUserId),
    mode: scope.mode,
    recentLimit: parsePositiveInteger(scope.recentLimit),
    timelineLimit: parsePositiveInteger(scope.timelineLimit),
    sinceDays: parsePositiveInteger(scope.sinceDays)
  };
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildReleaseTimeline(release: IncidentPackageRelease | null) {
  if (!release) {
    return [];
  }

  const events = [
    {
      id: `${release.id}-requested`,
      label: "Request submitted",
      description:
        release.requestNote ?? "Governed incident-package release request captured.",
      timestamp: release.requestedAt,
      tone: "warning" as const,
      metadata: [
        { label: "Target", value: toTitleCase(release.releaseTarget) },
        { label: "Mode", value: toTitleCase(release.exportMode) },
        { label: "Requester", value: release.requestedByOperatorId }
      ]
    }
  ];

  if (release.approvedAt) {
    events.push({
      id: `${release.id}-approved`,
      label: "Request approved",
      description: release.approvalNote ?? "Governed approval granted for this export.",
      timestamp: release.approvedAt,
      tone: "positive" as const,
      metadata: [{ label: "Approver", value: release.approvedByOperatorId ?? "unknown" }]
    });
  }

  if (release.rejectedAt) {
    events.push({
      id: `${release.id}-rejected`,
      label: "Request rejected",
      description: release.rejectionNote ?? "Release request was rejected.",
      timestamp: release.rejectedAt,
      tone: "critical" as const,
      metadata: [{ label: "Rejected by", value: release.rejectedByOperatorId ?? "unknown" }]
    });
  }

  if (release.releasedAt) {
    events.push({
      id: `${release.id}-released`,
      label: "Package released",
      description: release.releaseNote ?? "Approved export released to the target channel.",
      timestamp: release.releasedAt,
      tone: "technical" as const,
      metadata: [{ label: "Released by", value: release.releasedByOperatorId ?? "unknown" }]
    });
  }

  if (release.expiresAt && release.status === "approved") {
    events.push({
      id: `${release.id}-expires`,
      label: "Approval expiry deadline",
      description: "Approved incident-package exports must be released before this deadline.",
      timestamp: release.expiresAt,
      tone: "warning" as const,
      metadata: [{ label: "Status", value: toTitleCase(release.status) }]
    });
  }

  return events;
}

function mapIncidentPackageTimeline(snapshot: IncidentPackageSnapshot | null) {
  if (!snapshot) {
    return [];
  }

  return snapshot.timeline
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const eventType =
        typeof record.eventType === "string" ? record.eventType : "event_recorded";
      const actorId =
        typeof record.actorId === "string" && record.actorId.length > 0
          ? record.actorId
          : "system";
      const occurredAt =
        typeof record.occurredAt === "string" ? record.occurredAt : undefined;

      return {
        id:
          typeof record.id === "string" && record.id.length > 0
            ? record.id
            : `incident-package-timeline-${index}`,
        label: toTitleCase(eventType),
        description: `${toTitleCase(eventType)} recorded by ${actorId}.`,
        timestamp: occurredAt,
        tone: mapStatusToTone(eventType),
        metadata: [
          { label: "Actor", value: actorId },
          {
            label: "Review case",
            value:
              typeof record.reviewCaseId === "string" && record.reviewCaseId.length > 0
                ? record.reviewCaseId
                : "none"
          }
        ]
      };
    })
    .filter(Boolean);
}

function buildScopeFromRelease(
  release: IncidentPackageRelease
): IncidentPackageScopeDraft {
  return createScopeDraft({
    customerAccountId: release.customer.customerAccountId
  });
}

export function IncidentPackagesPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReleaseId = searchParams.get("release");
  const [appliedScope, setAppliedScope] = useState<IncidentPackageScopeDraft>(
    createScopeDraft()
  );
  const [scopeDraft, setScopeDraft] = useState<IncidentPackageScopeDraft>(
    createScopeDraft()
  );
  const [requestDraft, setRequestDraft] = useState<IncidentPackageReleaseRequestDraft>(
    createReleaseRequestDraft()
  );
  const [actionNote, setActionNote] = useState("");
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestFlash, setRequestFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const [requestConfirm, setRequestConfirm] = useState(false);
  const [decisionConfirm, setDecisionConfirm] = useState(false);

  const pendingReleasesQuery = useQuery({
    queryKey: ["incident-package-pending-releases", session?.baseUrl],
    queryFn: () => listPendingReleases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const releasedReleasesQuery = useQuery({
    queryKey: ["incident-package-released-releases", session?.baseUrl],
    queryFn: () => listReleasedReleases(session!, { limit: 20, sinceDays: 30 }),
    enabled: Boolean(session)
  });

  const incidentPackageQuery = useQuery({
    queryKey: ["incident-package-snapshot", session?.baseUrl, appliedScope],
    queryFn: () => getIncidentPackage(session!, buildIncidentPackageParams(appliedScope)),
    enabled: Boolean(session && hasIncidentPackageScope(appliedScope))
  });

  const governedExportQuery = useQuery({
    queryKey: ["incident-package-export", session?.baseUrl, appliedScope],
    queryFn: () =>
      getGovernedIncidentPackageExport(session!, buildIncidentPackageParams(appliedScope)),
    enabled: Boolean(session && hasIncidentPackageScope(appliedScope))
  });

  const selectedReleaseQuery = useQuery({
    queryKey: ["incident-package-release", session?.baseUrl, selectedReleaseId],
    queryFn: () => getRelease(session!, selectedReleaseId!),
    enabled: Boolean(session && selectedReleaseId)
  });

  const queueReleases = useMemo(
    () => [
      ...(pendingReleasesQuery.data?.releases ?? []),
      ...(releasedReleasesQuery.data?.releases ?? [])
    ],
    [pendingReleasesQuery.data, releasedReleasesQuery.data]
  );

  const queueReleaseMap = useMemo(
    () => new Map(queueReleases.map((release) => [release.id, release])),
    [queueReleases]
  );

  const selectedRelease =
    selectedReleaseQuery.data?.release ??
    (selectedReleaseId ? queueReleaseMap.get(selectedReleaseId) ?? null : null);

  useEffect(() => {
    const firstRelease = queueReleases[0];

    if (!selectedReleaseId && firstRelease) {
      setSearchParams({ release: firstRelease.id });
    }
  }, [queueReleases, selectedReleaseId, setSearchParams]);

  useEffect(() => {
    if (hasIncidentPackageScope(appliedScope)) {
      return;
    }

    if (selectedRelease) {
      const nextScope = buildScopeFromRelease(selectedRelease);
      setAppliedScope(nextScope);
      setScopeDraft(nextScope);
      return;
    }

    if (queueReleases[0]) {
      const nextScope = buildScopeFromRelease(queueReleases[0]);
      setAppliedScope(nextScope);
      setScopeDraft(nextScope);
    }
  }, [appliedScope, queueReleases, selectedRelease]);

  async function refreshWorkflow(selectedId = selectedReleaseId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["incident-package-pending-releases", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["incident-package-released-releases", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["incident-package-snapshot", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["incident-package-export", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["incident-package-release", session?.baseUrl, selectedId]
      })
    ]);
  }

  const requestReleaseMutation = useMutation({
    mutationFn: () =>
      createIncidentPackageReleaseRequest(session!, {
        ...buildIncidentPackageParams(appliedScope),
        releaseTarget: requestDraft.releaseTarget,
        releaseReasonCode: requestDraft.releaseReasonCode.trim(),
        requestNote: trimToUndefined(requestDraft.requestNote)
      }),
    onSuccess: async (result) => {
      setRequestError(null);
      setRequestFlash("Release request created.");
      setRequestConfirm(false);
      setActionFlash(null);
      setSearchParams({ release: result.release.id });
      await refreshWorkflow(result.release.id);
    },
    onError: (error) => {
      setRequestError(
        readApiErrorMessage(error, "Failed to create incident package release request.")
      );
    }
  });

  function createReleaseActionMutation(
    action: (
      releaseId: string,
      note?: string
    ) => Promise<unknown>,
    successMessage: string,
    fallbackMessage: string
  ) {
    return useMutation({
      mutationFn: () => action(selectedReleaseId!, trimToUndefined(actionNote)),
      onSuccess: async () => {
        setActionError(null);
        setActionFlash(successMessage);
        setDecisionConfirm(false);
        await refreshWorkflow();
      },
      onError: (error) => {
        setActionError(readApiErrorMessage(error, fallbackMessage));
      }
    });
  }

  const approveMutation = createReleaseActionMutation(
    (releaseId, note) => approveRelease(session!, releaseId, note),
    "Release approved.",
    "Failed to approve incident package release."
  );
  const rejectMutation = createReleaseActionMutation(
    (releaseId, note) => rejectRelease(session!, releaseId, note),
    "Release rejected.",
    "Failed to reject incident package release."
  );
  const releaseMutation = createReleaseActionMutation(
    (releaseId, note) => releaseApprovedPackage(session!, releaseId, note),
    "Package released.",
    "Failed to release approved incident package."
  );

  function applyScopeDraft() {
    if (!hasIncidentPackageScope(scopeDraft)) {
      setScopeError("Provide a customer account ID or Supabase user ID.");
      return;
    }

    setScopeError(null);
    setAppliedScope({ ...scopeDraft });
    setRequestFlash(null);
    setActionFlash(null);
  }

  function selectRelease(release: IncidentPackageRelease) {
    setSearchParams({ release: release.id });
    const nextScope = buildScopeFromRelease(release);
    setAppliedScope(nextScope);
    setScopeDraft(nextScope);
    setScopeError(null);
  }

  if (fallback) {
    return fallback;
  }

  if (pendingReleasesQuery.isLoading || releasedReleasesQuery.isLoading) {
    return (
      <LoadingState
        title="Loading incident packages"
        description="Governed release queues and package scope are loading."
      />
    );
  }

  if (pendingReleasesQuery.isError || releasedReleasesQuery.isError) {
    return (
      <ErrorState
        title="Incident package workflow unavailable"
        description="Pending or released package queues could not be loaded for this operator session."
      />
    );
  }

  const pendingReleases = pendingReleasesQuery.data!.releases;
  const releasedReleases = releasedReleasesQuery.data!.releases;
  const snapshot = incidentPackageQuery.data ?? null;
  const exportEnvelope = governedExportQuery.data ?? null;
  const selectedReleaseTimeline = buildReleaseTimeline(selectedRelease);
  const requestDisabled =
    !requestConfirm ||
    requestReleaseMutation.isPending ||
    requestDraft.releaseReasonCode.trim().length === 0 ||
    !hasIncidentPackageScope(appliedScope);
  const actionPending =
    approveMutation.isPending || rejectMutation.isPending || releaseMutation.isPending;
  const canApproveOrReject = selectedRelease?.status === "pending_approval";
  const canRelease = selectedRelease?.status === "approved";

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Incident package release"
        description="Governed customer-account package preview, approval-chain handling, and controlled release."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Pending approval"
            value={formatCount(pendingReleases.length)}
            detail="Release requests waiting for governed action."
          />
          <MetricCard
            label="Released"
            value={formatCount(releasedReleases.length)}
            detail="Packages already released through this workflow."
          />
          <MetricCard
            label="Open controls"
            value={formatCount(
              (exportEnvelope?.complianceSummary.openReviewCases ?? 0) +
                (exportEnvelope?.complianceSummary.openOversightIncidents ?? 0)
            )}
            detail="Open review cases and oversight incidents in the scoped package."
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Release workspace"
        description="Select package scope, review governed export detail, and execute the full approval lifecycle."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Pending approval">
                {pendingReleases.length === 0 ? (
                  <EmptyState
                    title="No pending requests"
                    description="New governed release requests will appear here."
                  />
                ) : (
                  <div className="admin-list">
                    {pendingReleases.map((release) => (
                      <button
                        key={release.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedReleaseId === release.id ? "selected" : ""
                        }`}
                        onClick={() => selectRelease(release)}
                      >
                        <strong>
                          {formatName(
                            release.customer.firstName,
                            release.customer.lastName
                          )}
                        </strong>
                        <span>{release.customer.email}</span>
                        <span>{toTitleCase(release.releaseTarget)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(release.status)}
                          tone={mapStatusToTone(release.status)}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </ListCard>

              <ListCard title="Released packages">
                {releasedReleases.length === 0 ? (
                  <EmptyState
                    title="No released packages"
                    description="Released artifacts will appear here once the workflow completes."
                  />
                ) : (
                  <div className="admin-list">
                    {releasedReleases.map((release) => (
                      <button
                        key={release.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedReleaseId === release.id ? "selected" : ""
                        }`}
                        onClick={() => selectRelease(release)}
                      >
                        <strong>
                          {formatName(
                            release.customer.firstName,
                            release.customer.lastName
                          )}
                        </strong>
                        <span>{release.customer.email}</span>
                        <span>{formatDateTime(release.releasedAt)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(release.status)}
                          tone={mapStatusToTone(release.status)}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </ListCard>
            </>
          }
          main={
            hasIncidentPackageScope(appliedScope) ? (
              <>
                {incidentPackageQuery.isLoading || governedExportQuery.isLoading ? (
                  <LoadingState
                    title="Loading scoped package"
                    description="Snapshot and governed export data are loading for the selected account."
                  />
                ) : incidentPackageQuery.isError || governedExportQuery.isError ? (
                  <ErrorState
                    title="Package preview unavailable"
                    description="The scoped incident package or governed export could not be loaded."
                  />
                ) : snapshot && exportEnvelope ? (
                  <>
                    <ListCard title="Scoped customer package">
                      <DetailList
                        items={[
                          {
                            label: "Customer",
                            value: formatName(
                              snapshot.customer.firstName,
                              snapshot.customer.lastName
                            )
                          },
                          { label: "Email", value: snapshot.customer.email, mono: true },
                          {
                            label: "Customer account",
                            value: snapshot.customer.customerAccountId,
                            mono: true
                          },
                          {
                            label: "Supabase user",
                            value: snapshot.customer.supabaseUserId,
                            mono: true
                          },
                          {
                            label: "Account status",
                            value: (
                              <AdminStatusBadge
                                label={toTitleCase(snapshot.accountStatus)}
                                tone={mapStatusToTone(snapshot.accountStatus)}
                              />
                            )
                          },
                          {
                            label: "Balances",
                            value: formatCount(snapshot.balances.length)
                          },
                          {
                            label: "Review cases",
                            value: formatCount(snapshot.reviewCases.length)
                          },
                          {
                            label: "Oversight incidents",
                            value: formatCount(snapshot.oversightIncidents.length)
                          }
                        ]}
                      />
                      <InlineNotice
                        title="Applied preview limits"
                        description={`Recent records: ${formatCount(
                          snapshot.limits.recentLimit
                        )}. Timeline entries: ${formatCount(snapshot.limits.timelineLimit)}.`}
                      />
                    </ListCard>

                    <ListCard title="Governed export preview">
                      <DetailList
                        items={[
                          {
                            label: "Export mode",
                            value: toTitleCase(exportEnvelope.exportMetadata.exportMode)
                          },
                          {
                            label: "Generated by",
                            value: exportEnvelope.exportMetadata.generatedByOperatorId,
                            mono: true
                          },
                          {
                            label: "Checksum",
                            value: shortenValue(
                              exportEnvelope.exportMetadata.packageChecksumSha256,
                              10
                            ),
                            mono: true
                          },
                          {
                            label: "Redactions applied",
                            value: exportEnvelope.exportMetadata.redactionsApplied
                              ? "Yes"
                              : "No"
                          },
                          {
                            label: "Manual resolutions",
                            value: formatCount(
                              exportEnvelope.complianceSummary
                                .manuallyResolvedTransactionIntents
                            )
                          },
                          {
                            label: "Active holds",
                            value: formatCount(
                              exportEnvelope.complianceSummary.activeAccountHolds
                            )
                          }
                        ]}
                      />
                      <InlineNotice
                        title="Executive summary"
                        description={exportEnvelope.narrative.executiveSummary}
                        tone="technical"
                      />
                      <InlineNotice
                        title="Control posture"
                        description={exportEnvelope.narrative.controlPosture}
                        tone={mapStatusToTone(exportEnvelope.complianceSummary.accountStatus)}
                      />
                      <div className="admin-field">
                        <span>Governed export payload</span>
                        <textarea
                          aria-label="Governed incident package export JSON"
                          className="admin-textarea"
                          value={stringifyJson(exportEnvelope.package)}
                          readOnly
                        />
                      </div>
                    </ListCard>

                    <TimelinePanel
                      title="Scoped account timeline"
                      description="Recent customer-account control events included in the package."
                      events={mapIncidentPackageTimeline(snapshot)}
                      emptyState={{
                        title: "No timeline events",
                        description:
                          "Recent customer-account events will appear here when the scoped account has recorded activity."
                      }}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No scoped package"
                    description="Apply a package scope to preview snapshot and export detail."
                  />
                )}

                {selectedRelease ? (
                  <>
                    <ListCard title="Selected release">
                      <DetailList
                        items={[
                          { label: "Release reference", value: selectedRelease.id, mono: true },
                          {
                            label: "Customer account",
                            value: selectedRelease.customer.customerAccountId,
                            mono: true
                          },
                          {
                            label: "Status",
                            value: (
                              <AdminStatusBadge
                                label={toTitleCase(selectedRelease.status)}
                                tone={mapStatusToTone(selectedRelease.status)}
                              />
                            )
                          },
                          {
                            label: "Release target",
                            value: toTitleCase(selectedRelease.releaseTarget)
                          },
                          {
                            label: "Reason code",
                            value: selectedRelease.releaseReasonCode,
                            mono: true
                          },
                          {
                            label: "Requested",
                            value: formatDateTime(selectedRelease.requestedAt)
                          },
                          {
                            label: "Approval expiry",
                            value: formatDateTime(selectedRelease.expiresAt)
                          }
                        ]}
                      />
                      {selectedRelease.requestNote ? (
                        <InlineNotice
                          title="Request note"
                          description={selectedRelease.requestNote}
                        />
                      ) : null}
                      {selectedRelease.approvalNote ? (
                        <InlineNotice
                          title="Approval note"
                          description={selectedRelease.approvalNote}
                          tone="positive"
                        />
                      ) : null}
                      {selectedRelease.rejectionNote ? (
                        <InlineNotice
                          title="Rejection note"
                          description={selectedRelease.rejectionNote}
                          tone="critical"
                        />
                      ) : null}
                      {selectedRelease.releaseNote ? (
                        <InlineNotice
                          title="Release note"
                          description={selectedRelease.releaseNote}
                          tone="technical"
                        />
                      ) : null}
                      <div className="admin-field">
                        <span>Stored release artifact</span>
                        <textarea
                          aria-label="Selected incident package artifact JSON"
                          className="admin-textarea"
                          value={stringifyJson(selectedRelease.artifactPayload)}
                          readOnly
                        />
                      </div>
                    </ListCard>

                    <TimelinePanel
                      title="Release audit timeline"
                      description="End-to-end operator actions for the selected governed release."
                      events={selectedReleaseTimeline}
                      emptyState={{
                        title: "No release activity",
                        description:
                          "Governed release actions will appear here after a request is created."
                      }}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="Select a release"
                    description="Choose a pending or released item to inspect governed release state."
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="Apply a package scope"
                description="Use the scope controls to load a customer-account incident package and governed export preview."
              />
            )
          }
          rail={
            <>
              <ActionRail
                title="Package scope"
                description="Scope the preview by account or Supabase user before creating a governed release request."
              >
                <div className="admin-field">
                  <span>Customer account ID</span>
                  <input
                    aria-label="Incident package customer account ID"
                    placeholder="account_123"
                    value={scopeDraft.customerAccountId}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        customerAccountId: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Supabase user ID</span>
                  <input
                    aria-label="Incident package Supabase user ID"
                    placeholder="supabase_user_123"
                    value={scopeDraft.supabaseUserId}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        supabaseUserId: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Export mode</span>
                  <select
                    aria-label="Incident package export mode"
                    value={scopeDraft.mode}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        mode: event.target.value as IncidentPackageScopeDraft["mode"]
                      }))
                    }
                  >
                    {incidentPackageExportModes.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-field">
                  <span>Recent records limit</span>
                  <input
                    aria-label="Incident package recent limit"
                    inputMode="numeric"
                    value={scopeDraft.recentLimit}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        recentLimit: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Timeline limit</span>
                  <input
                    aria-label="Incident package timeline limit"
                    inputMode="numeric"
                    value={scopeDraft.timelineLimit}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        timelineLimit: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Since days</span>
                  <input
                    aria-label="Incident package since days"
                    inputMode="numeric"
                    value={scopeDraft.sinceDays}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        sinceDays: event.target.value
                      }))
                    }
                  />
                </div>

                {scopeError ? (
                  <InlineNotice
                    title="Scope invalid"
                    description={scopeError}
                    tone="critical"
                  />
                ) : null}

                <div className="admin-action-buttons">
                  <button
                    type="button"
                    className="admin-primary-button"
                    onClick={applyScopeDraft}
                  >
                    Apply package scope
                  </button>
                </div>
              </ActionRail>

              <ActionRail
                title="Request release"
                description="Create a governed package release request from the scoped export preview."
              >
                <div className="admin-field">
                  <span>Release target</span>
                  <select
                    aria-label="Incident package release target"
                    value={requestDraft.releaseTarget}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        releaseTarget:
                          event.target.value as IncidentPackageReleaseRequestDraft["releaseTarget"]
                      }))
                    }
                  >
                    {incidentPackageReleaseTargets.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-field">
                  <span>Reason code</span>
                  <input
                    aria-label="Incident package release reason code"
                    placeholder="compliance_review_request"
                    value={requestDraft.releaseReasonCode}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        releaseReasonCode: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Request note</span>
                  <textarea
                    aria-label="Incident package request note"
                    placeholder="Summarize who needs the package and why governed release is required."
                    value={requestDraft.requestNote}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        requestNote: event.target.value
                      }))
                    }
                  />
                </div>

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={requestConfirm}
                    onChange={(event) => setRequestConfirm(event.target.checked)}
                  />
                  <span>
                    I verified the scoped customer account, export mode, and release target before requesting governed release.
                  </span>
                </label>

                {requestFlash ? (
                  <InlineNotice
                    title="Latest request action"
                    description={requestFlash}
                    tone="positive"
                  />
                ) : null}
                {requestError ? (
                  <InlineNotice
                    title="Request failed"
                    description={requestError}
                    tone="critical"
                  />
                ) : null}

                <div className="admin-action-buttons">
                  <button
                    type="button"
                    className="admin-primary-button"
                    disabled={requestDisabled}
                    onClick={() => requestReleaseMutation.mutate()}
                  >
                    <PendingLabel
                      idle="Create release request"
                      pending={requestReleaseMutation.isPending}
                      pendingLabel="Creating request..."
                    />
                  </button>
                </div>
              </ActionRail>

              <ActionRail
                title="Governed actions"
                description="Approve, reject, or release the currently selected incident-package request."
              >
                <div className="admin-field">
                  <span>Operator note</span>
                  <textarea
                    aria-label="Incident package operator note"
                    placeholder="Capture approval, rejection, or release context."
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                  />
                </div>

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={decisionConfirm}
                    onChange={(event) => setDecisionConfirm(event.target.checked)}
                  />
                  <span>
                    I reviewed the governed export, artifact checksum, and release target before taking action.
                  </span>
                </label>

                {selectedRelease?.status === "approved" && selectedRelease.expiresAt ? (
                  <InlineNotice
                    title="Approval expiry"
                    description={`Approved package expires at ${formatDateTime(
                      selectedRelease.expiresAt
                    )}.`}
                    tone="warning"
                  />
                ) : null}

                {actionFlash ? (
                  <InlineNotice
                    title="Latest governed action"
                    description={actionFlash}
                    tone="positive"
                  />
                ) : null}
                {actionError ? (
                  <InlineNotice
                    title="Governed action failed"
                    description={actionError}
                    tone="critical"
                  />
                ) : null}

                <div className="admin-action-buttons">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    disabled={!decisionConfirm || actionPending || !canApproveOrReject}
                    onClick={() => approveMutation.mutate()}
                  >
                    <PendingLabel
                      idle="Approve request"
                      pending={approveMutation.isPending}
                      pendingLabel="Approving..."
                    />
                  </button>
                  <button
                    type="button"
                    className="admin-danger-button"
                    disabled={!decisionConfirm || actionPending || !canApproveOrReject}
                    onClick={() => rejectMutation.mutate()}
                  >
                    <PendingLabel
                      idle="Reject request"
                      pending={rejectMutation.isPending}
                      pendingLabel="Rejecting..."
                    />
                  </button>
                  <button
                    type="button"
                    className="admin-primary-button"
                    disabled={!decisionConfirm || actionPending || !canRelease}
                    onClick={() => releaseMutation.mutate()}
                  >
                    <PendingLabel
                      idle="Release package"
                      pending={releaseMutation.isPending}
                      pendingLabel="Releasing..."
                    />
                  </button>
                </div>
              </ActionRail>
            </>
          }
        />
      </SectionPanel>
    </div>
  );
}
