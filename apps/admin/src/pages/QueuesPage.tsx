import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  addReviewCaseNote,
  applyManualResolution,
  decideAccountRelease,
  dismissReviewCase,
  getManualResolutionSummary,
  getReviewCaseWorkspace,
  handoffReviewCase,
  listPendingAccountReleaseReviews,
  listReviewCases,
  requestAccountRelease,
  resolveReviewCase,
  startReviewCase
} from "@/lib/api";
import { formatDateTime, formatName, readApiErrorMessage, shortenValue, toTitleCase, trimToUndefined } from "@/lib/format";
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
  SectionPanel,
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import {
  mapAuditEntriesToTimeline,
  mapIntentToTimeline,
  mapReviewCaseEventsToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard
} from "./shared";

const manualResolutionReasonOptions = [
  {
    value: "support_case_closed",
    label: "Support case closed"
  },
  {
    value: "duplicate_request_closed",
    label: "Duplicate request closed"
  },
  {
    value: "operator_override_not_needed",
    label: "Operator override not needed"
  }
];

export function QueuesPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReviewCaseId = searchParams.get("reviewCase");
  const [actionNote, setActionNote] = useState("");
  const [handoffOperatorId, setHandoffOperatorId] = useState("");
  const [manualResolutionReasonCode, setManualResolutionReasonCode] = useState(
    manualResolutionReasonOptions[0]!.value
  );
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [releaseDecisionSnapshot, setReleaseDecisionSnapshot] = useState<
    Awaited<ReturnType<typeof listPendingAccountReleaseReviews>>["reviews"][number] | null
  >(null);

  const reviewCasesQuery = useQuery({
    queryKey: ["review-cases", session?.baseUrl],
    queryFn: () => listReviewCases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const accountReleaseReviewsQuery = useQuery({
    queryKey: ["account-release-reviews", session?.baseUrl],
    queryFn: () => listPendingAccountReleaseReviews(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const manualResolutionSummaryQuery = useQuery({
    queryKey: ["manual-resolution-summary", session?.baseUrl],
    queryFn: () => getManualResolutionSummary(session!, { days: 30 }),
    enabled: Boolean(session)
  });

  const reviewWorkspaceQuery = useQuery({
    queryKey: ["review-workspace", session?.baseUrl, selectedReviewCaseId],
    queryFn: () => getReviewCaseWorkspace(session!, selectedReviewCaseId!, 10),
    enabled: Boolean(session && selectedReviewCaseId)
  });

  useEffect(() => {
    const firstId =
      reviewCasesQuery.data?.reviewCases[0]?.id ??
      accountReleaseReviewsQuery.data?.reviews[0]?.reviewCase.id;
    if (firstId && !selectedReviewCaseId) {
      setSearchParams({ reviewCase: firstId });
    }
  }, [
    accountReleaseReviewsQuery.data,
    reviewCasesQuery.data,
    selectedReviewCaseId,
    setSearchParams
  ]);

  useEffect(() => {
    setActionNote("");
    setHandoffOperatorId("");
    setGovernedConfirm(false);
    setFlash(null);
    setActionError(null);
    setReleaseDecisionSnapshot(null);
  }, [selectedReviewCaseId]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["review-cases", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["review-workspace", session?.baseUrl, selectedReviewCaseId]
      }),
      queryClient.invalidateQueries({
        queryKey: ["account-release-reviews", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["manual-resolution-summary", session?.baseUrl]
      })
    ]);
  }

  function clearActionState() {
    setFlash(null);
    setActionError(null);
  }

  const startCaseMutation = useMutation({
    mutationFn: () => startReviewCase(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Review case started.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to start review case."));
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: () => addReviewCaseNote(session!, selectedReviewCaseId!, actionNote.trim()),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Workspace note recorded.");
      setActionNote("");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to record workspace note."));
    }
  });

  const handoffMutation = useMutation({
    mutationFn: () =>
      handoffReviewCase(
        session!,
        selectedReviewCaseId!,
        handoffOperatorId.trim(),
        trimToUndefined(actionNote)
      ),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Review case handed off.");
      setHandoffOperatorId("");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to hand off review case."));
    }
  });

  const manualResolutionMutation = useMutation({
    mutationFn: () =>
      applyManualResolution(
        session!,
        selectedReviewCaseId!,
        manualResolutionReasonCode,
        trimToUndefined(actionNote)
      ),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Manual resolution applied.");
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to apply manual resolution."));
    }
  });

  const requestReleaseMutation = useMutation({
    mutationFn: () =>
      requestAccountRelease(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Account release review requested.");
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to request account release."));
    }
  });

  const approveReleaseMutation = useMutation({
    mutationFn: () =>
      decideAccountRelease(session!, selectedReviewCaseId!, "approved", trimToUndefined(actionNote)),
    onMutate: clearActionState,
    onSuccess: async () => {
      if (selectedReleaseReview) {
        setReleaseDecisionSnapshot({
          ...selectedReleaseReview,
          restriction: {
            ...selectedReleaseReview.restriction,
            releaseDecisionStatus: "approved",
            releaseDecidedAt: new Date().toISOString(),
            releaseDecidedByOperatorId: session!.operatorId,
            releaseDecisionNote: trimToUndefined(actionNote) ?? null
          }
        });
      }
      setFlash("Account release approved.");
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve account release."));
    }
  });

  const denyReleaseMutation = useMutation({
    mutationFn: () =>
      decideAccountRelease(session!, selectedReviewCaseId!, "denied", trimToUndefined(actionNote)),
    onMutate: clearActionState,
    onSuccess: async () => {
      if (selectedReleaseReview) {
        setReleaseDecisionSnapshot({
          ...selectedReleaseReview,
          restriction: {
            ...selectedReleaseReview.restriction,
            releaseDecisionStatus: "denied",
            releaseDecidedAt: new Date().toISOString(),
            releaseDecidedByOperatorId: session!.operatorId,
            releaseDecisionNote: trimToUndefined(actionNote) ?? null
          }
        });
      }
      setFlash("Account release denied.");
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to deny account release."));
    }
  });

  const resolveCaseMutation = useMutation({
    mutationFn: () => resolveReviewCase(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Review case resolved.");
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to resolve review case."));
    }
  });

  const dismissCaseMutation = useMutation({
    mutationFn: () => dismissReviewCase(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Review case dismissed.");
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to dismiss review case."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (
    reviewCasesQuery.isLoading ||
    accountReleaseReviewsQuery.isLoading ||
    manualResolutionSummaryQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading queues"
        description="Review cases, manual-resolution posture, and release reviews are loading."
      />
    );
  }

  if (
    reviewCasesQuery.isError ||
    accountReleaseReviewsQuery.isError ||
    manualResolutionSummaryQuery.isError
  ) {
    return (
      <ErrorState
        title="Queue state unavailable"
        description="The review-case queue or release-review posture could not be loaded. Recheck the operator session or retry the request."
      />
    );
  }

  const workspace = reviewWorkspaceQuery.data;
  const selectedReviewCase =
    workspace?.reviewCase ??
    reviewCasesQuery.data!.reviewCases.find((reviewCase) => reviewCase.id === selectedReviewCaseId) ??
    accountReleaseReviewsQuery.data!.reviews.find(
      (review) => review.reviewCase.id === selectedReviewCaseId
    )?.reviewCase ??
    null;
  const pendingReleaseReview =
    accountReleaseReviewsQuery.data!.reviews.find(
      (review) => review.reviewCase.id === selectedReviewCaseId
    ) ?? null;
  const selectedReleaseReview =
    pendingReleaseReview ??
    (releaseDecisionSnapshot?.reviewCase.id === selectedReviewCaseId
      ? releaseDecisionSnapshot
      : null);
  const hasPendingReleaseReview =
    pendingReleaseReview?.restriction.releaseDecisionStatus === "pending";
  const pendingGovernedAction =
    manualResolutionMutation.isPending ||
    requestReleaseMutation.isPending ||
    approveReleaseMutation.isPending ||
    denyReleaseMutation.isPending ||
    resolveCaseMutation.isPending ||
    dismissCaseMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Operational queues"
        description="Review ownership, manual-resolution posture, and governed release decisions."
      >
        <div className="admin-metric-grid">
          <MetricCard
            label="Open review cases"
            value={`${reviewCasesQuery.data!.reviewCases.length}`}
            detail="Active queue items requiring operator ownership or review."
          />
          <MetricCard
            label="Pending release reviews"
            value={`${accountReleaseReviewsQuery.data!.reviews.length}`}
            detail="Restricted accounts waiting for a governed release decision."
          />
          <MetricCard
            label="Manual resolutions"
            value={`${manualResolutionSummaryQuery.data!.totalIntents}`}
            detail="Intent resolutions reported across the last 30 days."
          />
        </div>

        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Review cases">
                <div className="admin-list">
                  {reviewCasesQuery.data!.reviewCases.map((reviewCase) => (
                    <button
                      key={reviewCase.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedReviewCaseId === reviewCase.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ reviewCase: reviewCase.id })}
                    >
                      <strong>
                        {formatName(
                          reviewCase.customer.firstName,
                          reviewCase.customer.lastName
                        )}
                      </strong>
                      <span>{toTitleCase(reviewCase.type)}</span>
                      <span>{toTitleCase(reviewCase.reasonCode)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(reviewCase.status)}
                        tone={mapStatusToTone(reviewCase.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Pending release reviews">
                <div className="admin-list">
                  {accountReleaseReviewsQuery.data!.reviews.length > 0 ? (
                    accountReleaseReviewsQuery.data!.reviews.map((review) => (
                      <button
                        key={review.reviewCase.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedReviewCaseId === review.reviewCase.id ? "selected" : ""
                        }`}
                        onClick={() => setSearchParams({ reviewCase: review.reviewCase.id })}
                      >
                        <strong>{review.customer.email}</strong>
                        <span>{toTitleCase(review.restriction.restrictionReasonCode)}</span>
                        <span>{toTitleCase(review.oversightIncident.status)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(review.restriction.releaseDecisionStatus)}
                          tone={mapStatusToTone(review.restriction.releaseDecisionStatus)}
                        />
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      title="No pending release reviews"
                      description="Governed account release decisions will appear here when they need approval."
                    />
                  )}
                </div>
              </ListCard>
            </>
          }
          main={
            workspace ? (
              <>
                <ListCard title="Selected workspace">
                  <DetailList
                    items={[
                      {
                        label: "Case reference",
                        value: workspace.reviewCase.id,
                        mono: true
                      },
                      {
                        label: "Customer",
                        value: formatName(
                          workspace.reviewCase.customer.firstName,
                          workspace.reviewCase.customer.lastName
                        )
                      },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(workspace.reviewCase.status)}
                            tone={mapStatusToTone(workspace.reviewCase.status)}
                          />
                        )
                      },
                      {
                        label: "Eligibility",
                        value: workspace.manualResolutionEligibility.recommendedAction
                      },
                      {
                        label: "Assigned operator",
                        value: workspace.reviewCase.assignedOperatorId ?? "Not assigned"
                      },
                      {
                        label: "Opened",
                        value: formatDateTime(workspace.reviewCase.createdAt)
                      }
                    ]}
                  />
                  <InlineNotice
                    tone={workspace.manualResolutionEligibility.eligible ? "warning" : "neutral"}
                    title="Manual resolution posture"
                    description={workspace.manualResolutionEligibility.reason}
                  />
                </ListCard>

                {selectedReleaseReview ? (
                  <ListCard title="Release review detail">
                    <DetailList
                      items={[
                        {
                          label: "Restricted account",
                          value: selectedReleaseReview.customer.email
                        },
                        {
                          label: "Hold reference",
                          value: selectedReleaseReview.restriction.id,
                          mono: true
                        },
                        {
                          label: "Decision state",
                          value: (
                            <AdminStatusBadge
                              label={toTitleCase(
                                selectedReleaseReview.restriction.releaseDecisionStatus
                              )}
                              tone={mapStatusToTone(
                                selectedReleaseReview.restriction.releaseDecisionStatus
                              )}
                            />
                          )
                        },
                        {
                          label: "Requested",
                          value: formatDateTime(
                            selectedReleaseReview.restriction.releaseRequestedAt
                          )
                        },
                        {
                          label: "Request note",
                          value:
                            selectedReleaseReview.restriction.releaseRequestNote ??
                            "No release request note"
                        },
                        {
                          label: "Oversight incident",
                          value: selectedReleaseReview.oversightIncident.id,
                          mono: true
                        }
                      ]}
                    />
                    <InlineNotice
                      tone={hasPendingReleaseReview ? "warning" : "neutral"}
                      title={
                        hasPendingReleaseReview
                          ? "Governed release decision required"
                          : "Latest release decision captured"
                      }
                      description={
                        hasPendingReleaseReview
                          ? "The restriction remains active until an operator explicitly approves or denies the requested release."
                          : selectedReleaseReview.restriction.releaseDecisionNote ??
                            "The latest release decision is preserved in the current workspace."
                      }
                    />
                  </ListCard>
                ) : null}

                <ListCard title="Balances and intent context">
                  {workspace.balances.length > 0 ? (
                    <div className="admin-list">
                      {workspace.balances.map((balance) => (
                        <div key={balance.asset.id} className="admin-list-row">
                          <strong>{balance.asset.symbol}</strong>
                          <span>{balance.availableBalance} available</span>
                          <span>{balance.pendingBalance} pending</span>
                          <span>{formatDateTime(balance.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No balance context"
                      description="Customer balances were not returned for this review case."
                    />
                  )}
                </ListCard>

                <ListCard title="Recent intent context">
                  {workspace.recentIntents.length > 0 ? (
                    <div className="admin-list">
                      {workspace.recentIntents.map((intent) => (
                        <div key={intent.id} className="admin-list-row">
                          <strong>{toTitleCase(intent.intentType)}</strong>
                          <span>{intent.requestedAmount}</span>
                          <span>{toTitleCase(intent.status)}</span>
                          <span>{shortenValue(intent.latestBlockchainTransaction?.txHash)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No recent intents"
                      description="Linked transaction intents will appear here when review context is available."
                    />
                  )}
                </ListCard>

                <TimelinePanel
                  title="Review timeline"
                  description="Case events and operator-authored notes for the selected review."
                  events={mapReviewCaseEventsToTimeline(workspace.caseEvents)}
                  emptyState={{
                    title: "No review events",
                    description: "Case events will appear here as the workspace changes state."
                  }}
                />

                <TimelinePanel
                  title="Transaction audit trace"
                  description="Related transaction audit history for the linked intent."
                  events={
                    workspace.reviewCase.transactionIntent
                      ? [
                          ...mapIntentToTimeline(workspace.reviewCase.transactionIntent),
                          ...mapAuditEntriesToTimeline(workspace.relatedTransactionAuditEvents)
                        ]
                      : mapAuditEntriesToTimeline(workspace.relatedTransactionAuditEvents)
                  }
                  emptyState={{
                    title: "No audit trace",
                    description: "Audit entries will appear when the review case links to transaction activity."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select a review case"
                description="Choose a queue item to inspect balances, release posture, and recent audit context."
              />
            )
          }
          rail={
            <ActionRail
              title="Governed actions"
              description="Operator actions require evidence review, optional notes, and explicit confirmation for release or manual-resolution outcomes."
            >
              {selectedReviewCase ? (
                <>
                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Operator note"
                      placeholder="Summarize the rationale, evidence, release posture, or handoff context."
                      value={actionNote}
                      onChange={(event) => setActionNote(event.target.value)}
                    />
                    <p className="admin-field-help">
                      Notes are attached to governed actions and remain visible in the audit trail.
                    </p>
                  </div>

                  <div className="admin-field">
                    <span>Next operator</span>
                    <input
                      aria-label="Next operator"
                      type="text"
                      placeholder="ops_compliance_1"
                      value={handoffOperatorId}
                      onChange={(event) => setHandoffOperatorId(event.target.value)}
                    />
                    <p className="admin-field-help">
                      Use handoff when the current reviewer is not the best owner for the case.
                    </p>
                  </div>

                  <div className="admin-field">
                    <span>Manual resolution reason</span>
                    <select
                      aria-label="Manual resolution reason"
                      value={manualResolutionReasonCode}
                      onChange={(event) => setManualResolutionReasonCode(event.target.value)}
                    >
                      {manualResolutionReasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={governedConfirm}
                      onChange={(event) => setGovernedConfirm(event.target.checked)}
                    />
                    <span>
                      I reviewed balances, timeline, intent state, and release posture before taking a governed action.
                    </span>
                  </label>

                  {selectedReleaseReview ? (
                    <InlineNotice
                      title="Release review posture"
                      description={
                        hasPendingReleaseReview
                          ? "A release request is pending. Approve or deny it before clearing the restriction workflow."
                          : selectedReleaseReview.restriction.releaseDecisionNote ??
                            "The last decision is still visible while this workspace remains selected."
                      }
                      tone={hasPendingReleaseReview ? "warning" : "neutral"}
                    />
                  ) : (
                    <InlineNotice
                      title="Release review posture"
                      description="No pending release decision is attached to the selected review case."
                      tone="neutral"
                    />
                  )}

                  {flash ? (
                    <InlineNotice title="Last action" description={flash} tone="positive" />
                  ) : null}
                  {actionError ? (
                    <InlineNotice title="Action failed" description={actionError} tone="critical" />
                  ) : null}

                  <div className="admin-action-buttons">
                    <button
                      type="button"
                      className="admin-primary-button"
                      disabled={startCaseMutation.isPending}
                      onClick={() => startCaseMutation.mutate()}
                    >
                      {startCaseMutation.isPending ? "Starting..." : "Start case"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={addNoteMutation.isPending || actionNote.trim().length === 0}
                      onClick={() => addNoteMutation.mutate()}
                    >
                      {addNoteMutation.isPending ? "Recording..." : "Record note"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={handoffMutation.isPending || handoffOperatorId.trim().length === 0}
                      onClick={() => handoffMutation.mutate()}
                    >
                      {handoffMutation.isPending ? "Handing off..." : "Handoff case"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        !workspace?.manualResolutionEligibility.eligible ||
                        !governedConfirm ||
                        pendingGovernedAction
                      }
                      onClick={() => manualResolutionMutation.mutate()}
                    >
                      {manualResolutionMutation.isPending
                        ? "Applying..."
                        : "Apply manual resolution"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || hasPendingReleaseReview || pendingGovernedAction}
                      onClick={() => requestReleaseMutation.mutate()}
                    >
                      {requestReleaseMutation.isPending
                        ? "Requesting..."
                        : "Request account release review"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || !hasPendingReleaseReview || pendingGovernedAction}
                      onClick={() => approveReleaseMutation.mutate()}
                    >
                      {approveReleaseMutation.isPending
                        ? "Approving..."
                        : "Approve account release"}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || !hasPendingReleaseReview || pendingGovernedAction}
                      onClick={() => denyReleaseMutation.mutate()}
                    >
                      {denyReleaseMutation.isPending ? "Denying..." : "Deny account release"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || pendingGovernedAction}
                      onClick={() => resolveCaseMutation.mutate()}
                    >
                      {resolveCaseMutation.isPending ? "Resolving..." : "Resolve case"}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || pendingGovernedAction}
                      onClick={() => dismissCaseMutation.mutate()}
                    >
                      {dismissCaseMutation.isPending ? "Dismissing..." : "Dismiss case"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No action target"
                  description="Select a review case to unlock governed actions."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>

      <SectionPanel
        title="Manual resolution reporting"
        description="Reason distribution and operator footprint for recent manual resolutions."
      >
        <div className="admin-two-column">
          <ListCard title="By reason">
            <div className="admin-list">
              {manualResolutionSummaryQuery.data!.byReasonCode.map((entry) => (
                <div key={entry.manualResolutionReasonCode} className="admin-list-row">
                  <strong>{toTitleCase(entry.manualResolutionReasonCode)}</strong>
                  <span>{entry.count}</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              ))}
            </div>
          </ListCard>
          <ListCard title="By operator">
            <div className="admin-list">
              {manualResolutionSummaryQuery.data!.byOperator.map((entry) => (
                <div key={entry.manualResolvedByOperatorId} className="admin-list-row">
                  <strong>{entry.manualResolvedByOperatorId}</strong>
                  <span>{toTitleCase(entry.manualResolutionOperatorRole ?? "unknown")}</span>
                  <span>{entry.count}</span>
                  <span>{shortenValue(entry.manualResolvedByOperatorId)}</span>
                </div>
              ))}
            </div>
          </ListCard>
        </div>
      </SectionPanel>
    </div>
  );
}
