import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveRetirementVaultReleaseRequest,
  getRetirementVaultReleaseRequestWorkspace,
  listRetirementVaultReleaseRequests,
  rejectRetirementVaultReleaseRequest,
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
  WorkspaceLayout,
} from "@/components/console/primitives";
import {
  mapAuditEntriesToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard,
} from "./shared";

const statusFilterOptions = [
  { value: "all", label: "All active work" },
  { value: "review_required", label: "Review required" },
  { value: "cooldown_active", label: "Cooldown active" },
  { value: "ready_for_release", label: "Ready for release" },
  { value: "executing", label: "Executing" },
  { value: "released", label: "Released" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
] as const;

function mapVaultEventsToTimeline(
  events: Awaited<
    ReturnType<typeof getRetirementVaultReleaseRequestWorkspace>
  >["vaultEvents"],
) {
  return events.map((event) => ({
    id: event.id,
    label: toTitleCase(event.eventType),
    description: `Vault activity recorded by ${toTitleCase(event.actorType)} ${
      event.actorId ?? "system"
    }.`,
    timestamp: event.createdAt,
    tone: mapStatusToTone(event.eventType),
    metadata: [{ label: "Actor", value: event.actorId ?? "system" }],
  }));
}

export function VaultReleasesPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReleaseRequestId = searchParams.get("releaseRequest");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilterOptions)[number]["value"]>("all");
  const [actionNote, setActionNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const releaseRequestsQuery = useQuery({
    queryKey: ["retirement-vault-release-requests", session?.baseUrl, statusFilter],
    queryFn: () =>
      listRetirementVaultReleaseRequests(session!, {
        limit: 30,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    enabled: Boolean(session),
  });

  const workspaceQuery = useQuery({
    queryKey: [
      "retirement-vault-release-request-workspace",
      session?.baseUrl,
      selectedReleaseRequestId,
    ],
    queryFn: () =>
      getRetirementVaultReleaseRequestWorkspace(session!, selectedReleaseRequestId!),
    enabled: Boolean(session && selectedReleaseRequestId),
  });

  useEffect(() => {
    const firstReleaseRequestId = releaseRequestsQuery.data?.releaseRequests[0]?.id;
    if (firstReleaseRequestId && !selectedReleaseRequestId) {
      setSearchParams({ releaseRequest: firstReleaseRequestId });
    }
  }, [releaseRequestsQuery.data, selectedReleaseRequestId, setSearchParams]);

  useEffect(() => {
    setActionNote("");
    setFlash(null);
    setActionError(null);
  }, [selectedReleaseRequestId]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["retirement-vault-release-requests", session?.baseUrl],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "retirement-vault-release-request-workspace",
          session?.baseUrl,
          selectedReleaseRequestId,
        ],
      }),
    ]);
  }

  function clearActionState() {
    setFlash(null);
    setActionError(null);
  }

  const approveMutation = useMutation({
    mutationFn: () =>
      approveRetirementVaultReleaseRequest(session!, selectedReleaseRequestId!, {
        note: trimToUndefined(actionNote),
      }),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault release request approved.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve release request."));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectRetirementVaultReleaseRequest(session!, selectedReleaseRequestId!, {
        note: trimToUndefined(actionNote),
      }),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault release request rejected.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to reject release request."));
    },
  });

  if (fallback) {
    return fallback;
  }

  if (releaseRequestsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading vault releases"
        description="Retirement vault release requests and operator context are loading."
      />
    );
  }

  if (releaseRequestsQuery.isError) {
    return (
      <ErrorState
        title="Vault release queue unavailable"
        description="The retirement vault release queue could not be loaded. Recheck the operator session or retry the request."
      />
    );
  }

  const releaseRequests = releaseRequestsQuery.data!.releaseRequests;
  const selectedReleaseRequest =
    workspaceQuery.data?.releaseRequest ??
    releaseRequests.find((request) => request.id === selectedReleaseRequestId) ??
    null;
  const pendingReviewCount = releaseRequests.filter(
    (request) => request.status === "review_required",
  ).length;
  const cooldownCount = releaseRequests.filter(
    (request) => request.status === "cooldown_active",
  ).length;
  const failureCount = releaseRequests.filter(
    (request) => request.status === "failed",
  ).length;
  const pendingDecision =
    approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Retirement Vault releases"
        description="Governed unlock reviews, cooldown tracking, and operator decisions for protected retirement vault funds."
        action={
          <div className="admin-field">
            <span>Status filter</span>
            <select
              aria-label="Retirement vault release status filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as (typeof statusFilterOptions)[number]["value"],
                )
              }
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="admin-metric-grid">
          <MetricCard
            label="Visible requests"
            value={`${releaseRequests.length}`}
            detail="Filtered retirement vault release requests visible to the current operator session."
          />
          <MetricCard
            label="Pending review"
            value={`${pendingReviewCount}`}
            detail="Early unlock requests still waiting for operator approval or rejection."
          />
          <MetricCard
            label="Cooldown / failed"
            value={`${cooldownCount} / ${failureCount}`}
            detail="Requests currently cooling down versus requests that need release execution follow-up."
          />
        </div>

        <WorkspaceLayout
          sidebar={
            <ListCard title="Release queue">
              <div className="admin-list">
                {releaseRequests.length > 0 ? (
                  releaseRequests.map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedReleaseRequestId === request.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ releaseRequest: request.id })}
                    >
                      <strong>
                        {request.retirementVault.customerAccount.customer.email}
                      </strong>
                      <span>
                        {request.retirementVault.asset.symbol} · {request.requestedAmount}
                      </span>
                      <span>{toTitleCase(request.requestKind)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(request.status)}
                        tone={mapStatusToTone(request.status)}
                      />
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No vault releases"
                    description="Retirement vault release requests will appear here when customers open governed unlock workflows."
                  />
                )}
              </div>
            </ListCard>
          }
          main={
            selectedReleaseRequest ? (
              <>
                <ListCard title="Release request detail">
                  <DetailList
                    items={[
                      {
                        label: "Request reference",
                        value: selectedReleaseRequest.id,
                        mono: true,
                      },
                      {
                        label: "Customer",
                        value: formatName(
                          selectedReleaseRequest.retirementVault.customerAccount.customer.firstName,
                          selectedReleaseRequest.retirementVault.customerAccount.customer.lastName,
                        ),
                      },
                      {
                        label: "Customer email",
                        value:
                          selectedReleaseRequest.retirementVault.customerAccount.customer.email,
                      },
                      {
                        label: "Vault asset",
                        value: `${selectedReleaseRequest.retirementVault.asset.displayName} (${selectedReleaseRequest.retirementVault.asset.symbol})`,
                      },
                      {
                        label: "Requested amount",
                        value: selectedReleaseRequest.requestedAmount,
                      },
                      {
                        label: "Current status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedReleaseRequest.status)}
                            tone={mapStatusToTone(selectedReleaseRequest.status)}
                          />
                        ),
                      },
                      {
                        label: "Unlock date",
                        value: formatDateTime(
                          selectedReleaseRequest.retirementVault.unlockAt,
                        ),
                      },
                      {
                        label: "Locked balance",
                        value: selectedReleaseRequest.retirementVault.lockedBalance,
                      },
                    ]}
                  />
                  <InlineNotice
                    title="Protection posture"
                    tone={
                      selectedReleaseRequest.requestKind === "early_unlock"
                        ? "warning"
                        : "neutral"
                    }
                    description={
                      selectedReleaseRequest.requestKind === "early_unlock"
                        ? "This request is attempting to break the vault before its natural unlock date. Approval should remain high-friction and evidence-backed."
                        : "This request follows the configured unlock date and is moving through the governed cooldown path."
                    }
                  />
                  {selectedReleaseRequest.reasonCode || selectedReleaseRequest.reasonNote ? (
                    <InlineNotice
                      title="Customer rationale"
                      description={
                        selectedReleaseRequest.reasonNote
                          ? `${toTitleCase(selectedReleaseRequest.reasonCode)} · ${selectedReleaseRequest.reasonNote}`
                          : toTitleCase(selectedReleaseRequest.reasonCode)
                      }
                      tone="neutral"
                    />
                  ) : null}
                  {selectedReleaseRequest.evidence ? (
                    <InlineNotice
                      title="Attached evidence context"
                      description={JSON.stringify(selectedReleaseRequest.evidence)}
                      tone="technical"
                    />
                  ) : null}
                </ListCard>

                <ListCard title="Linked governance">
                  <DetailList
                    items={[
                      {
                        label: "Review case",
                        value: selectedReleaseRequest.reviewCase
                          ? shortenValue(selectedReleaseRequest.reviewCase.id)
                          : "Not attached",
                        mono: Boolean(selectedReleaseRequest.reviewCase),
                      },
                      {
                        label: "Review status",
                        value: selectedReleaseRequest.reviewCase ? (
                          <AdminStatusBadge
                            label={toTitleCase(selectedReleaseRequest.reviewCase.status)}
                            tone={mapStatusToTone(
                              selectedReleaseRequest.reviewCase.status,
                            )}
                          />
                        ) : (
                          "No review case"
                        ),
                      },
                      {
                        label: "Release intent",
                        value: selectedReleaseRequest.transactionIntent
                          ? shortenValue(selectedReleaseRequest.transactionIntent.id)
                          : "Not created",
                        mono: Boolean(selectedReleaseRequest.transactionIntent),
                      },
                      {
                        label: "Cooldown ends",
                        value: selectedReleaseRequest.cooldownEndsAt
                          ? formatDateTime(selectedReleaseRequest.cooldownEndsAt)
                          : "Not in cooldown",
                      },
                      {
                        label: "Worker",
                        value:
                          selectedReleaseRequest.executedByWorkerId ?? "Not claimed",
                      },
                    ]}
                  />
                </ListCard>

                {workspaceQuery.isLoading ? (
                  <LoadingState
                    title="Loading release workspace"
                    description="Vault events and audit trail are loading for the selected request."
                  />
                ) : workspaceQuery.isError ? (
                  <ErrorState
                    title="Workspace unavailable"
                    description="The selected retirement vault release request could not be loaded."
                  />
                ) : workspaceQuery.data ? (
                  <>
                    <TimelinePanel
                      title="Vault timeline"
                      description="Visible vault events for this protected-funds workflow."
                      events={mapVaultEventsToTimeline(workspaceQuery.data.vaultEvents)}
                      emptyState={{
                        title: "No vault events",
                        description:
                          "Funding, review, cooldown, and release activity will appear here.",
                      }}
                    />
                    <TimelinePanel
                      title="Audit trail"
                      description="Cross-system audit events linked to the vault, release request, review case, or release intent."
                      events={mapAuditEntriesToTimeline(
                        workspaceQuery.data.relatedAuditEvents,
                      )}
                      emptyState={{
                        title: "No audit events",
                        description:
                          "Audit-linked activity will appear here as the governed release progresses.",
                      }}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No workspace loaded"
                    description="Choose a retirement vault release request to inspect its audit and timeline context."
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="No release request selected"
                description="Choose a retirement vault release request to inspect the governed unlock workflow."
              />
            )
          }
          rail={
            <ActionRail
              title="Release decisions"
              description="Early unlock approval is intentionally explicit. Record rationale before moving protected funds toward cooldown or rejection."
            >
              {flash ? (
                <InlineNotice title="Action recorded" description={flash} tone="positive" />
              ) : null}
              {actionError ? (
                <InlineNotice title="Action failed" description={actionError} tone="critical" />
              ) : null}
              <textarea
                className="admin-textarea"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="Operator note or release governance rationale"
              />
              <div className="admin-action-group">
                <button
                  type="button"
                  className="admin-button admin-button--positive"
                  disabled={
                    !selectedReleaseRequestId ||
                    pendingDecision ||
                    selectedReleaseRequest?.status !== "review_required"
                  }
                  onClick={() => void approveMutation.mutate()}
                >
                  Approve into cooldown
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={
                    !selectedReleaseRequestId ||
                    pendingDecision ||
                    selectedReleaseRequest?.status !== "review_required"
                  }
                  onClick={() => void rejectMutation.mutate()}
                >
                  Reject request
                </button>
              </div>
              {selectedReleaseRequest ? (
                <InlineNotice
                  title="Selected request"
                  description={`${
                    selectedReleaseRequest.retirementVault.asset.symbol
                  } · ${selectedReleaseRequest.requestedAmount} · ${toTitleCase(
                    selectedReleaseRequest.status,
                  )}`}
                  tone={mapStatusToTone(selectedReleaseRequest.status)}
                />
              ) : null}
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
