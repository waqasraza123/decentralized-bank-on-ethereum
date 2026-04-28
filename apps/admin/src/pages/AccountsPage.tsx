import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  addOversightIncidentNote,
  applyAccountRestriction,
  dismissOversightIncident,
  getAccountHoldSummary,
  getOversightIncidentWorkspace,
  listCustomerAccountTimeline,
  listActiveAccountHolds,
  listOversightIncidents,
  resolveOversightIncident,
  startOversightIncident
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
import {
  ActionRail,
  AdminStatusBadge,
  DetailList,
  EmptyState,
  ErrorState,
  InlineNotice,
  ListCard,
  LoadingState,
  PendingLabel,
  SectionPanel,
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import {
  mapCustomerAccountTimelineEntriesToTimeline,
  mapOversightEventsToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard
} from "./shared";

type AccountTimelineFilterDraft = {
  eventType: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
};

const accountTimelineFilterKeys = ["eventType", "actorId", "dateFrom", "dateTo"] as const;

function createAccountTimelineFilterDraft(
  searchParams: URLSearchParams
): AccountTimelineFilterDraft {
  return {
    eventType: searchParams.get("timelineEventType") ?? "",
    actorId: searchParams.get("timelineActorId") ?? "",
    dateFrom: searchParams.get("timelineDateFrom") ?? "",
    dateTo: searchParams.get("timelineDateTo") ?? ""
  };
}

function buildCustomerAccountTimelineParams(
  searchParams: URLSearchParams,
  customerAccountId: string | null | undefined,
  supabaseUserId: string | null | undefined
) {
  return {
    customerAccountId: customerAccountId ?? undefined,
    supabaseUserId: supabaseUserId ?? undefined,
    limit: 30,
    eventType: searchParams.get("timelineEventType")?.trim() || undefined,
    actorId: searchParams.get("timelineActorId")?.trim() || undefined,
    dateFrom: searchParams.get("timelineDateFrom")?.trim() || undefined,
    dateTo: searchParams.get("timelineDateTo")?.trim() || undefined
  };
}

function countActiveTimelineFilters(filters: AccountTimelineFilterDraft): number {
  return accountTimelineFilterKeys.reduce((count, key) => {
    return filters[key].trim().length > 0 ? count + 1 : count;
  }, 0);
}

export function AccountsPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIncidentId = searchParams.get("incident");
  const [timelineFilterDraft, setTimelineFilterDraft] = useState<AccountTimelineFilterDraft>(() =>
    createAccountTimelineFilterDraft(searchParams)
  );
  const [actionNote, setActionNote] = useState("");
  const [restrictionReasonCode, setRestrictionReasonCode] = useState("manual_review_hold");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const selectedIncident =
    incidentsQuery.data?.oversightIncidents.find((incident) => incident.id === selectedIncidentId) ??
    null;

  const timelineQuery = useQuery({
    queryKey: [
      "customer-account-timeline",
      session?.baseUrl,
      selectedIncident?.subjectCustomer.customerAccountId,
      selectedIncident?.subjectCustomer.supabaseUserId,
      searchParams.toString()
    ],
    queryFn: () =>
      listCustomerAccountTimeline(
        session!,
        buildCustomerAccountTimelineParams(
          searchParams,
          selectedIncident?.subjectCustomer.customerAccountId,
          selectedIncident?.subjectCustomer.supabaseUserId
        )
      ),
    enabled: Boolean(
      session &&
        selectedIncident &&
        (selectedIncident.subjectCustomer.customerAccountId ||
          selectedIncident.subjectCustomer.supabaseUserId)
    ),
    retry: false
  });

  useEffect(() => {
    const firstId = incidentsQuery.data?.oversightIncidents[0]?.id;
    if (firstId && !selectedIncidentId) {
      const next = new URLSearchParams(searchParams);
      next.set("incident", firstId);
      setSearchParams(next);
    }
  }, [incidentsQuery.data, searchParams, selectedIncidentId, setSearchParams]);

  useEffect(() => {
    setTimelineFilterDraft(createAccountTimelineFilterDraft(searchParams));
  }, [searchParams]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["oversight-incidents", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["oversight-workspace", session?.baseUrl, selectedIncidentId]
      }),
      queryClient.invalidateQueries({ queryKey: ["active-account-holds", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["account-hold-summary", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["customer-account-timeline", session?.baseUrl] })
    ]);
  }

  const startIncidentMutation = useMutation({
    mutationFn: () => startOversightIncident(session!, selectedIncidentId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Oversight incident started.");
      setActionError(null);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to start oversight incident."));
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: () => addOversightIncidentNote(session!, selectedIncidentId!, actionNote.trim()),
    onSuccess: async () => {
      setFlash("Oversight note recorded.");
      setActionError(null);
      setActionNote("");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to record oversight note."));
    }
  });

  const applyRestrictionMutation = useMutation({
    mutationFn: () =>
      applyAccountRestriction(
        session!,
        selectedIncidentId!,
        restrictionReasonCode,
        trimToUndefined(actionNote)
      ),
    onSuccess: async () => {
      setFlash("Account hold applied.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to apply account restriction."));
    }
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: () =>
      resolveOversightIncident(session!, selectedIncidentId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Oversight incident resolved.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to resolve oversight incident."));
    }
  });

  const dismissIncidentMutation = useMutation({
    mutationFn: () =>
      dismissOversightIncident(session!, selectedIncidentId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Oversight incident dismissed.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to dismiss oversight incident."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (
    incidentsQuery.isLoading ||
    activeAccountHoldsQuery.isLoading ||
    accountHoldSummaryQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading account workspaces"
        description="Incident context, holds, and review posture are loading."
      />
    );
  }

  if (
    incidentsQuery.isError ||
    activeAccountHoldsQuery.isError ||
    accountHoldSummaryQuery.isError
  ) {
    return (
      <ErrorState
        title="Account review state unavailable"
        description="Customer restrictions and oversight context could not be loaded."
      />
    );
  }

  const workspace = workspaceQuery.data;
  const timeline = timelineQuery.data;
  const appliedTimelineFilters = createAccountTimelineFilterDraft(searchParams);
  const activeTimelineFilterCount = countActiveTimelineFilters(appliedTimelineFilters);
  const pendingGovernedAction =
    applyRestrictionMutation.isPending ||
    resolveIncidentMutation.isPending ||
    dismissIncidentMutation.isPending;

  function selectIncident(incidentId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("incident", incidentId);
    setSearchParams(next);
  }

  function applyTimelineFilters() {
    const next = new URLSearchParams(searchParams);

    for (const key of accountTimelineFilterKeys) {
      const paramKey = `timeline${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      const value = timelineFilterDraft[key].trim();

      if (value.length > 0) {
        next.set(paramKey, value);
      } else {
        next.delete(paramKey);
      }
    }

    setSearchParams(next);
  }

  function clearTimelineFilters() {
    const next = new URLSearchParams(searchParams);
    next.delete("timelineEventType");
    next.delete("timelineActorId");
    next.delete("timelineDateFrom");
    next.delete("timelineDateTo");
    setSearchParams(next);
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Accounts and reviews"
        description="Customer restriction posture, incident evidence, and governed hold actions."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Oversight incidents">
                <div className="admin-list">
                  {incidentsQuery.data!.oversightIncidents.map((incident) => (
                    <button
                      key={incident.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedIncidentId === incident.id ? "selected" : ""
                      }`}
                      onClick={() => selectIncident(incident.id)}
                    >
                      <strong>
                        {formatName(
                          incident.subjectCustomer.firstName,
                          incident.subjectCustomer.lastName
                        )}
                      </strong>
                      <span>{toTitleCase(incident.incidentType)}</span>
                      <span>{toTitleCase(incident.reasonCode)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(incident.status)}
                        tone={mapStatusToTone(incident.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Active account holds">
                {activeAccountHoldsQuery.data!.holds.length > 0 ? (
                  <div className="admin-list">
                    {activeAccountHoldsQuery.data!.holds.map((hold) => (
                      <div key={hold.hold.id} className="admin-list-row">
                        <strong>{hold.customer.email}</strong>
                        <span>{toTitleCase(hold.hold.restrictionReasonCode)}</span>
                        <span>{toTitleCase(hold.releaseReview.decisionStatus)}</span>
                        <span>{formatDateTime(hold.hold.appliedAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No active account holds"
                    description="Live restrictions will appear here when customer accounts are actively constrained."
                  />
                )}
              </ListCard>
            </>
          }
          main={
            workspace ? (
              <>
                <ListCard title="Incident workspace">
                  <DetailList
                    items={[
                      {
                        label: "Incident reference",
                        value: workspace.oversightIncident.id,
                        mono: true
                      },
                      {
                        label: "Customer",
                        value: formatName(
                          workspace.oversightIncident.subjectCustomer.firstName,
                          workspace.oversightIncident.subjectCustomer.lastName
                        )
                      },
                      {
                        label: "Current status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(workspace.oversightIncident.status)}
                            tone={mapStatusToTone(workspace.oversightIncident.status)}
                          />
                        )
                      },
                      {
                        label: "Restriction state",
                        value: workspace.accountRestriction.active ? "Restricted" : "Not restricted"
                      },
                      {
                        label: "Restriction reason",
                        value: toTitleCase(workspace.accountRestriction.restrictionReasonCode)
                      },
                      {
                        label: "Opened",
                        value: formatDateTime(workspace.oversightIncident.openedAt)
                      }
                    ]}
                  />
                  <InlineNotice
                    tone={workspace.accountRestriction.active ? "critical" : "warning"}
                    title={
                      workspace.accountRestriction.active
                        ? "Account is currently restricted"
                        : "Account hold governance available"
                    }
                    description={
                      workspace.accountRestriction.active
                        ? "Customer movement is constrained until the hold is released through governed review."
                        : "This workspace can place an account hold when evidence supports it."
                    }
                  />
                </ListCard>

                <ListCard title="Customer account investigation summary">
                  {timelineQuery.isLoading ? (
                    <InlineNotice
                      title="Loading customer account timeline"
                      description="Unified transaction, review, incident, and restriction history is loading for the selected customer account."
                      tone="technical"
                    />
                  ) : timelineQuery.isError ? (
                    <InlineNotice
                      title="Customer account timeline unavailable"
                      description={readApiErrorMessage(
                        timelineQuery.error,
                        "Customer account operations history could not be loaded for this incident subject."
                      )}
                      tone="critical"
                    />
                  ) : timeline ? (
                    <>
                      <DetailList
                        items={[
                          {
                            label: "Customer account",
                            value: timeline.summary.customer.customerAccountId,
                            mono: true
                          },
                          {
                            label: "Supabase user",
                            value: timeline.summary.customer.supabaseUserId,
                            mono: true
                          },
                          {
                            label: "Customer email",
                            value: timeline.summary.customer.email
                          },
                          {
                            label: "Account status",
                            value: (
                              <AdminStatusBadge
                                label={toTitleCase(timeline.summary.accountStatus)}
                                tone={mapStatusToTone(timeline.summary.accountStatus)}
                              />
                            )
                          },
                          {
                            label: "Current restriction",
                            value: timeline.summary.currentRestriction.active
                              ? toTitleCase(
                                  timeline.summary.currentRestriction.restrictionReasonCode
                                )
                              : "No active restriction"
                          },
                          {
                            label: "Restriction recorded",
                            value: timeline.summary.currentRestriction.restrictedAt
                              ? formatDateTime(timeline.summary.currentRestriction.restrictedAt)
                              : "Not restricted"
                          },
                          {
                            label: "Transaction intents",
                            value: formatCount(timeline.summary.counts.totalTransactionIntents)
                          },
                          {
                            label: "Manually resolved intents",
                            value: formatCount(
                              timeline.summary.counts.manuallyResolvedTransactionIntents
                            )
                          },
                          {
                            label: "Open review cases",
                            value: formatCount(timeline.summary.counts.openReviewCases)
                          },
                          {
                            label: "Open oversight incidents",
                            value: formatCount(timeline.summary.counts.openOversightIncidents)
                          },
                          {
                            label: "Active account holds",
                            value: formatCount(timeline.summary.counts.activeAccountHolds)
                          }
                        ]}
                      />
                      <InlineNotice
                        title="Unified investigation chronology"
                        description="This slice combines transaction intent, review-case, oversight-incident, and account-hold events for the selected customer account."
                        tone="technical"
                      />
                    </>
                  ) : (
                    <EmptyState
                      title="No customer account timeline"
                      description="Select an incident with a linked customer account to inspect unified account activity."
                    />
                  )}
                </ListCard>

                <ListCard title="Customer account timeline filters">
                  <div className="admin-two-column">
                    <div className="admin-field">
                      <span>Event type</span>
                      <input
                        aria-label="Timeline event type"
                        placeholder="account_hold.applied"
                        value={timelineFilterDraft.eventType}
                        onChange={(event) =>
                          setTimelineFilterDraft((current) => ({
                            ...current,
                            eventType: event.target.value
                          }))
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <span>Actor reference</span>
                      <input
                        aria-label="Timeline actor ID"
                        placeholder="ops_e2e"
                        value={timelineFilterDraft.actorId}
                        onChange={(event) =>
                          setTimelineFilterDraft((current) => ({
                            ...current,
                            actorId: event.target.value
                          }))
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <span>Date from</span>
                      <input
                        aria-label="Timeline date from"
                        placeholder="2026-04-01T00:00:00.000Z"
                        value={timelineFilterDraft.dateFrom}
                        onChange={(event) =>
                          setTimelineFilterDraft((current) => ({
                            ...current,
                            dateFrom: event.target.value
                          }))
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <span>Date to</span>
                      <input
                        aria-label="Timeline date to"
                        placeholder="2026-04-30T23:59:59.000Z"
                        value={timelineFilterDraft.dateTo}
                        onChange={(event) =>
                          setTimelineFilterDraft((current) => ({
                            ...current,
                            dateTo: event.target.value
                          }))
                        }
                      />
                    </div>
                  </div>
                  {activeTimelineFilterCount > 0 ? (
                    <InlineNotice
                      title="Applied filter summary"
                      description={`${formatCount(
                        activeTimelineFilterCount
                      )} active filters are shaping the customer account timeline.`}
                      tone="technical"
                    />
                  ) : null}
                  <div className="admin-action-buttons">
                    <button
                      type="button"
                      className="admin-primary-button"
                      disabled={!selectedIncident}
                      onClick={applyTimelineFilters}
                    >
                      Apply timeline filters
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={activeTimelineFilterCount === 0}
                      onClick={clearTimelineFilters}
                    >
                      Clear timeline filters
                    </button>
                  </div>
                </ListCard>

                <ListCard title="Linked reviews and manual resolutions">
                  <div className="admin-list">
                    {workspace.recentReviewCases.map((reviewCase) => (
                      <div key={reviewCase.id} className="admin-list-row">
                        <strong>{reviewCase.id}</strong>
                        <span>{toTitleCase(reviewCase.type)}</span>
                        <span>{toTitleCase(reviewCase.status)}</span>
                        <span>{formatDateTime(reviewCase.updatedAt)}</span>
                      </div>
                    ))}
                    {workspace.recentManuallyResolvedIntents.map((intent) => (
                      <div key={intent.id} className="admin-list-row">
                        <strong>{intent.customer.email}</strong>
                        <span>{toTitleCase(intent.intentType)}</span>
                        <span>{toTitleCase(intent.manualResolutionReasonCode)}</span>
                        <span>{formatDateTime(intent.manuallyResolvedAt)}</span>
                      </div>
                    ))}
                  </div>
                </ListCard>

                <TimelinePanel
                  title="Customer account operations timeline"
                  description="Unified chronology across account-level restrictions, review workflows, and transaction activity."
                  events={mapCustomerAccountTimelineEntriesToTimeline(timeline?.timeline ?? [])}
                  emptyState={{
                    title: timelineQuery.isError
                      ? "Customer account timeline unavailable"
                      : "No customer account activity matched",
                    description: timelineQuery.isError
                      ? "The incident workspace remains available while the broader account chronology is unavailable."
                      : activeTimelineFilterCount > 0
                        ? "Adjust the filters to inspect a different slice of customer account activity."
                        : "Timeline entries will appear here when customer account operations are available."
                  }}
                />

                <TimelinePanel
                  title="Incident timeline"
                  description="Incident events, operator notes, and state changes."
                  events={mapOversightEventsToTimeline(workspace.events)}
                  emptyState={{
                    title: "No incident activity",
                    description: "Timeline entries will appear as the oversight workflow progresses."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select an incident"
                description="Choose an incident to inspect restriction state and linked review activity."
              />
            )
          }
          rail={
            <ActionRail
              title="Restriction controls"
              description="These actions affect customer access and should only follow evidence review."
            >
              {workspace ? (
                <>
                  <div className="admin-field">
                    <span>Restriction reason</span>
                    <select
                      aria-label="Restriction reason"
                      value={restrictionReasonCode}
                      onChange={(event) => setRestrictionReasonCode(event.target.value)}
                    >
                      <option value="manual_review_hold">Manual review hold</option>
                      <option value="oversight_incident">Oversight incident</option>
                      <option value="risk_control">Risk control</option>
                    </select>
                  </div>

                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Oversight note"
                      placeholder="Summarize the evidence, customer impact, and expected next step."
                      value={actionNote}
                      onChange={(event) => setActionNote(event.target.value)}
                    />
                  </div>

                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={governedConfirm}
                      onChange={(event) => setGovernedConfirm(event.target.checked)}
                    />
                    <span>
                      I reviewed the incident timeline, related cases, and current restriction state.
                    </span>
                  </label>

                  <InlineNotice
                    title="Hold summary"
                    description={`Open holds: ${accountHoldSummaryQuery.data?.activeHolds ?? 0}. Latest hold ${
                      activeAccountHoldsQuery.data!.holds[0]
                        ? `belongs to ${activeAccountHoldsQuery.data!.holds[0].customer.email}.`
                        : "is not currently present."
                    }`}
                    tone="neutral"
                  />
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
                      disabled={startIncidentMutation.isPending}
                      onClick={() => startIncidentMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Start incident"
                        pending={startIncidentMutation.isPending}
                        pendingLabel="Starting..."
                      />
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={addNoteMutation.isPending || actionNote.trim().length === 0}
                      onClick={() => addNoteMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Record note"
                        pending={addNoteMutation.isPending}
                        pendingLabel="Recording..."
                      />
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        !workspace.accountHoldGovernance.canApplyAccountHold ||
                        !governedConfirm ||
                        pendingGovernedAction
                      }
                      onClick={() => applyRestrictionMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Apply account hold"
                        pending={applyRestrictionMutation.isPending}
                        pendingLabel="Applying..."
                      />
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || pendingGovernedAction}
                      onClick={() => resolveIncidentMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Resolve incident"
                        pending={resolveIncidentMutation.isPending}
                        pendingLabel="Resolving..."
                      />
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || pendingGovernedAction}
                      onClick={() => dismissIncidentMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Dismiss incident"
                        pending={dismissIncidentMutation.isPending}
                        pendingLabel="Dismissing..."
                      />
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No incident selected"
                  description="Select an oversight incident to unlock restriction controls."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>

      <SectionPanel
        title="Hold distribution"
        description="Recent hold posture by reason and operator."
      >
        <div className="admin-two-column">
          <ListCard title="By reason">
            <div className="admin-list">
              {accountHoldSummaryQuery.data!.byReasonCode.map((entry) => (
                <div key={entry.restrictionReasonCode} className="admin-list-row">
                  <strong>{toTitleCase(entry.restrictionReasonCode)}</strong>
                  <span>{entry.count}</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              ))}
            </div>
          </ListCard>
          <ListCard title="By applied operator">
            <div className="admin-list">
              {accountHoldSummaryQuery.data!.byAppliedOperator.map((entry) => (
                <div key={entry.appliedByOperatorId} className="admin-list-row">
                  <strong>{entry.appliedByOperatorId}</strong>
                  <span>{toTitleCase(entry.appliedByOperatorRole)}</span>
                  <span>{entry.count}</span>
                  <span>{shortenValue(entry.appliedByOperatorId)}</span>
                </div>
              ))}
            </div>
          </ListCard>
        </div>
      </SectionPanel>
    </div>
  );
}
