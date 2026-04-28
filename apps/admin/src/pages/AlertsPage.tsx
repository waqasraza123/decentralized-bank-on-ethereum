import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  acknowledgePlatformAlert,
  assignPlatformAlertOwner,
  clearPlatformAlertSuppression,
  listPlatformAlertDeliveryTargetHealth,
  listPlatformAlerts,
  listOversightAlerts,
  retryPlatformAlertDeliveries,
  routeCriticalPlatformAlerts,
  routePlatformAlertToReviewCase,
  suppressPlatformAlert
} from "@/lib/api";
import { formatCount, formatDateTime, readApiErrorMessage, toTitleCase, trimToUndefined } from "@/lib/format";
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
import { mapPlatformAlertToTimeline, mapStatusToTone, useConfiguredSessionGuard } from "./shared";

type AlertFilters = {
  status: string;
  severity: string;
  category: string;
  routingStatus: string;
  ownerOperatorId: string;
  acknowledged: string;
  suppressed: string;
};

const emptyAlertFilters: AlertFilters = {
  status: "",
  severity: "",
  category: "",
  routingStatus: "",
  ownerOperatorId: "",
  acknowledged: "",
  suppressed: ""
};

function readAlertFilters(searchParams: URLSearchParams): AlertFilters {
  return {
    status: searchParams.get("status")?.trim() ?? "",
    severity: searchParams.get("severity")?.trim() ?? "",
    category: searchParams.get("category")?.trim() ?? "",
    routingStatus: searchParams.get("routingStatus")?.trim() ?? "",
    ownerOperatorId: searchParams.get("ownerOperatorId")?.trim() ?? "",
    acknowledged: searchParams.get("acknowledged")?.trim() ?? "",
    suppressed: searchParams.get("suppressed")?.trim() ?? ""
  };
}

function buildSuppressionIso(hoursFromNow = 4): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

export function AlertsPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterDraft, setFilterDraft] = useState<AlertFilters>(() => readAlertFilters(searchParams));
  const [actionNote, setActionNote] = useState("");
  const [ownerOperatorId, setOwnerOperatorId] = useState("");
  const [suppressedUntil, setSuppressedUntil] = useState(buildSuppressionIso());
  const [criticalRouteLimit, setCriticalRouteLimit] = useState("10");
  const [criticalRouteStaleAfterSeconds, setCriticalRouteStaleAfterSeconds] = useState("180");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [criticalRoutingSummary, setCriticalRoutingSummary] = useState<{
    routedCount: number;
    remainingUnroutedCriticalAlertCount: number;
  } | null>(null);

  const selectedAlertId = searchParams.get("alert");
  const activeFilters = readAlertFilters(searchParams);

  const platformAlertsQuery = useQuery({
    queryKey: ["platform-alerts", session?.baseUrl, activeFilters],
    queryFn: () =>
      listPlatformAlerts(session!, {
        limit: 20,
        ...Object.fromEntries(
          Object.entries(activeFilters).filter(([, value]) => value.trim().length > 0)
        )
      }),
    enabled: Boolean(session)
  });

  const deliveryHealthQuery = useQuery({
    queryKey: ["delivery-health", session?.baseUrl],
    queryFn: () => listPlatformAlertDeliveryTargetHealth(session!, { lookbackHours: 24 }),
    enabled: Boolean(session)
  });

  const oversightAlertsQuery = useQuery({
    queryKey: ["oversight-alerts", session?.baseUrl],
    queryFn: () => listOversightAlerts(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  useEffect(() => {
    setFilterDraft(readAlertFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const alerts = platformAlertsQuery.data?.alerts ?? [];
    const hasSelectedAlert = selectedAlertId
      ? alerts.some((alert) => alert.id === selectedAlertId)
      : false;

    if (alerts.length === 0 && selectedAlertId) {
      const next = new URLSearchParams(searchParams);
      next.delete("alert");
      setSearchParams(next);
      return;
    }

    if (alerts.length > 0 && !hasSelectedAlert) {
      const next = new URLSearchParams(searchParams);
      next.set("alert", alerts[0].id);
      setSearchParams(next);
    }
  }, [platformAlertsQuery.data, searchParams, selectedAlertId, setSearchParams]);

  const selectedAlert =
    platformAlertsQuery.data?.alerts.find((alert) => alert.id === selectedAlertId) ?? null;

  useEffect(() => {
    setActionNote("");
    setActionError(null);
    setFlash(null);
    setGovernedConfirm(false);
    setOwnerOperatorId(selectedAlert?.ownerOperatorId ?? session?.operatorId ?? "");
    setSuppressedUntil(selectedAlert?.suppressedUntil ?? buildSuppressionIso());
  }, [selectedAlert?.id, session?.operatorId]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["platform-alerts", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-health", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["oversight-alerts", session?.baseUrl] })
    ]);
  }

  function selectAlert(alertId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("alert", alertId);
    setSearchParams(next);
  }

  function applyFilterDraft() {
    const next = new URLSearchParams(searchParams);
    const entries = Object.entries(filterDraft);

    for (const [key, value] of entries) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        next.set(key, trimmed);
      } else {
        next.delete(key);
      }
    }

    next.delete("alert");
    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of Object.keys(emptyAlertFilters)) {
      next.delete(key);
    }
    next.delete("alert");
    setFilterDraft(emptyAlertFilters);
    setSearchParams(next);
  }

  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgePlatformAlert(session!, selectedAlertId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Alert acknowledged.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to acknowledge alert."));
    }
  });

  const assignOwnerMutation = useMutation({
    mutationFn: () =>
      assignPlatformAlertOwner(
        session!,
        selectedAlertId!,
        ownerOperatorId.trim(),
        trimToUndefined(actionNote)
      ),
    onSuccess: async () => {
      setFlash(`Assigned alert owner to ${ownerOperatorId.trim()}.`);
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to assign alert owner."));
    }
  });

  const suppressMutation = useMutation({
    mutationFn: () =>
      suppressPlatformAlert(
        session!,
        selectedAlertId!,
        suppressedUntil.trim(),
        trimToUndefined(actionNote)
      ),
    onSuccess: async () => {
      setFlash("Alert suppression updated.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to suppress alert."));
    }
  });

  const clearSuppressionMutation = useMutation({
    mutationFn: () =>
      clearPlatformAlertSuppression(session!, selectedAlertId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Alert suppression cleared.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to clear alert suppression."));
    }
  });

  const routeMutation = useMutation({
    mutationFn: () =>
      routePlatformAlertToReviewCase(session!, selectedAlertId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Alert routed to review case.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to route alert to review case."));
    }
  });

  const retryMutation = useMutation({
    mutationFn: () =>
      retryPlatformAlertDeliveries(session!, selectedAlertId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Delivery retry requested.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to retry alert deliveries."));
    }
  });

  const routeCriticalMutation = useMutation({
    mutationFn: () =>
      routeCriticalPlatformAlerts(session!, {
        limit: Number.parseInt(criticalRouteLimit, 10) || 10,
        staleAfterSeconds: Number.parseInt(criticalRouteStaleAfterSeconds, 10) || 180,
        note: trimToUndefined(actionNote)
      }),
    onSuccess: async (result) => {
      setFlash(`Routed ${formatCount(result.routedAlerts.length)} critical alerts.`);
      setCriticalRoutingSummary({
        routedCount: result.routedAlerts.length,
        remainingUnroutedCriticalAlertCount: result.remainingUnroutedCriticalAlertCount
      });
      setActionError(null);
      setGovernedConfirm(false);
      if (result.routedAlerts[0]?.alert.id) {
        selectAlert(result.routedAlerts[0].alert.id);
      }
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to route critical alerts."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (
    platformAlertsQuery.isLoading ||
    deliveryHealthQuery.isLoading ||
    oversightAlertsQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading alerts and incidents"
        description="Platform alerts, delivery health, and oversight alert activity are loading."
      />
    );
  }

  if (
    platformAlertsQuery.isError ||
    deliveryHealthQuery.isError ||
    oversightAlertsQuery.isError
  ) {
    return (
      <ErrorState
        title="Alert state unavailable"
        description="Platform alerts or delivery-health data could not be loaded."
      />
    );
  }

  const mutationPending =
    acknowledgeMutation.isPending ||
    assignOwnerMutation.isPending ||
    suppressMutation.isPending ||
    clearSuppressionMutation.isPending ||
    routeMutation.isPending ||
    retryMutation.isPending ||
    routeCriticalMutation.isPending;

  const selectedAlertTimeline = selectedAlert ? mapPlatformAlertToTimeline(selectedAlert) : [];

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Alerts and incidents"
        description="Alert ownership, escalation posture, and governed routing actions."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Platform alerts"
            value={formatCount(platformAlertsQuery.data!.alerts.length)}
            detail="Loaded alert scope"
          />
          <MetricCard
            label="Critical targets"
            value={formatCount(deliveryHealthQuery.data!.summary.criticalTargetCount)}
            detail={`${formatCount(deliveryHealthQuery.data!.summary.warningTargetCount)} warning`}
          />
          <MetricCard
            label="Oversight alerts"
            value={formatCount(oversightAlertsQuery.data!.alerts.length)}
            detail="Incident monitoring feed"
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Platform alert workspace"
        description="Persist alert filters, inspect delivery posture, and execute governed alert actions from one console."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Alert filters">
                <div className="admin-detail-stack">
                  <label className="admin-field">
                    <span>Status</span>
                    <select
                      aria-label="Alert status filter"
                      value={filterDraft.status}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          status: event.target.value
                        }))
                      }
                    >
                      <option value="">All statuses</option>
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Severity</span>
                    <select
                      aria-label="Alert severity filter"
                      value={filterDraft.severity}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          severity: event.target.value
                        }))
                      }
                    >
                      <option value="">All severities</option>
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Category</span>
                    <select
                      aria-label="Alert category filter"
                      value={filterDraft.category}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          category: event.target.value
                        }))
                      }
                    >
                      <option value="">All categories</option>
                      <option value="worker">Worker</option>
                      <option value="reconciliation">Reconciliation</option>
                      <option value="queue">Queue</option>
                      <option value="chain">Chain</option>
                      <option value="treasury">Treasury</option>
                      <option value="operations">Operations</option>
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Routing</span>
                    <select
                      aria-label="Alert routing filter"
                      value={filterDraft.routingStatus}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          routingStatus: event.target.value
                        }))
                      }
                    >
                      <option value="">All routing states</option>
                      <option value="unrouted">Unrouted</option>
                      <option value="routed">Routed</option>
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Acknowledged</span>
                    <select
                      aria-label="Alert acknowledgement filter"
                      value={filterDraft.acknowledged}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          acknowledged: event.target.value
                        }))
                      }
                    >
                      <option value="">All acknowledgement states</option>
                      <option value="true">Acknowledged</option>
                      <option value="false">Unacknowledged</option>
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Suppressed</span>
                    <select
                      aria-label="Alert suppression filter"
                      value={filterDraft.suppressed}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          suppressed: event.target.value
                        }))
                      }
                    >
                      <option value="">All suppression states</option>
                      <option value="true">Suppressed</option>
                      <option value="false">Not suppressed</option>
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Owner operator</span>
                    <input
                      aria-label="Alert owner filter"
                      placeholder="ops_e2e"
                      value={filterDraft.ownerOperatorId}
                      onChange={(event) =>
                        setFilterDraft((current) => ({
                          ...current,
                          ownerOperatorId: event.target.value
                        }))
                      }
                    />
                  </label>

                  <div className="admin-action-buttons">
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={applyFilterDraft}
                    >
                      Apply filters
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              </ListCard>

              <ListCard title="Platform alerts">
                {platformAlertsQuery.data!.alerts.length === 0 ? (
                  <EmptyState
                    title="No alerts in scope"
                    description="Adjust the current filters or wait for the next platform alert cycle."
                  />
                ) : (
                  <div className="admin-list">
                    {platformAlertsQuery.data!.alerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedAlertId === alert.id ? "selected" : ""
                        }`}
                        onClick={() => selectAlert(alert.id)}
                      >
                        <strong>{alert.summary}</strong>
                        <span>{toTitleCase(alert.category)}</span>
                        <span>{toTitleCase(alert.routingStatus)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(alert.severity)}
                          tone={mapStatusToTone(alert.severity)}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </ListCard>

              <ListCard title="Delivery health">
                <div className="admin-list">
                  {deliveryHealthQuery.data!.targets.map((target) => (
                    <div key={target.targetName} className="admin-list-row">
                      <strong>{target.targetName}</strong>
                      <span>{toTitleCase(target.healthStatus)}</span>
                      <span>{formatCount(target.recentDeliveryCount)} deliveries</span>
                      <span>{formatDateTime(target.lastAttemptedAt)}</span>
                    </div>
                  ))}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedAlert ? (
              <>
                <ListCard title="Selected alert">
                  <div className="admin-detail-stack">
                    <DetailList
                      items={[
                        { label: "Alert reference", value: selectedAlert.id, mono: true },
                        { label: "Code", value: selectedAlert.code, mono: true },
                        {
                          label: "Severity",
                          value: (
                            <AdminStatusBadge
                              label={toTitleCase(selectedAlert.severity)}
                              tone={mapStatusToTone(selectedAlert.severity)}
                            />
                          )
                        },
                        { label: "Status", value: toTitleCase(selectedAlert.status) },
                        { label: "Routing", value: toTitleCase(selectedAlert.routingStatus) },
                        { label: "Owner", value: selectedAlert.ownerOperatorId ?? "Unassigned" },
                        { label: "Last detected", value: formatDateTime(selectedAlert.lastDetectedAt) }
                      ]}
                    />

                    {selectedAlert.detail ? (
                      <InlineNotice
                        title="Alert detail"
                        description={selectedAlert.detail}
                        tone={mapStatusToTone(selectedAlert.severity)}
                      />
                    ) : null}

                    <InlineNotice
                      tone={selectedAlert.hasActiveSuppression ? "warning" : "critical"}
                      title={
                        selectedAlert.hasActiveSuppression
                          ? "Suppression is active"
                          : selectedAlert.routingStatus === "routed"
                            ? "Alert has active review routing"
                            : "Operator attention required"
                      }
                      description={
                        selectedAlert.hasActiveSuppression
                          ? `Suppressed until ${formatDateTime(selectedAlert.suppressedUntil)}.`
                          : selectedAlert.routingStatus === "routed"
                            ? `Linked review case: ${selectedAlert.routingTargetId ?? "Not available"}.`
                            : "Alert remains active until it is acknowledged, routed, or resolved."
                      }
                    />
                  </div>
                </ListCard>

                <ListCard title="Delivery posture">
                  <DetailList
                    items={[
                      {
                        label: "Failed deliveries",
                        value: formatCount(selectedAlert.deliverySummary.failedCount)
                      },
                      {
                        label: "Pending deliveries",
                        value: formatCount(selectedAlert.deliverySummary.pendingCount)
                      },
                      {
                        label: "Highest escalation",
                        value: formatCount(selectedAlert.deliverySummary.highestEscalationLevel)
                      },
                      {
                        label: "Last target",
                        value: selectedAlert.deliverySummary.lastTargetName ?? "Not available"
                      },
                      {
                        label: "Last delivery status",
                        value: selectedAlert.deliverySummary.lastStatus ?? "Not available"
                      },
                      {
                        label: "Last failure",
                        value: selectedAlert.deliverySummary.lastErrorMessage ?? "No recent failure"
                      }
                    ]}
                  />
                </ListCard>

                <TimelinePanel
                  title="Alert timeline"
                  description="Detection, routing, ownership, acknowledgement, delivery, and suppression state."
                  events={selectedAlertTimeline}
                  emptyState={{
                    title: "No alert history",
                    description: "Timeline data will appear when the alert changes state."
                  }}
                />

                <ListCard title="Oversight alert feed">
                  <div className="admin-list">
                    {oversightAlertsQuery.data!.alerts.map((alert) => (
                      <div
                        key={`${alert.incidentType}-${alert.subjectCustomer?.customerId ?? alert.subjectOperatorId ?? "global"}`}
                        className="admin-list-row"
                      >
                        <strong>{toTitleCase(alert.incidentType)}</strong>
                        <span>{alert.subjectCustomer?.email ?? alert.subjectOperatorId ?? "Unknown"}</span>
                        <span>{formatCount(alert.count)} hits</span>
                        <span>{toTitleCase(alert.recommendedAction)}</span>
                      </div>
                    ))}
                  </div>
                </ListCard>
              </>
            ) : (
              <EmptyState
                title="Select an alert"
                description="Choose a platform alert to inspect delivery posture and routing state."
              />
            )
          }
          rail={
            <ActionRail
              title="Alert controls"
              description="Capture rationale for every governed alert action because it changes ownership, delivery, and downstream queue posture."
            >
              <div className="admin-field">
                <span>Operator note</span>
                <textarea
                  aria-label="Alert note"
                  placeholder="Capture why the alert was acknowledged, routed, reassigned, retried, or suppressed."
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
                  I reviewed severity, delivery posture, routing impact, and whether this action preserves accountable follow-up.
                </span>
              </label>

              {flash ? <InlineNotice title="Last action" description={flash} tone="positive" /> : null}
              {actionError ? (
                <InlineNotice title="Action failed" description={actionError} tone="critical" />
              ) : null}
              {criticalRoutingSummary ? (
                <InlineNotice
                  title="Critical routing summary"
                  description={`${formatCount(
                    criticalRoutingSummary.routedCount
                  )} routed, ${formatCount(
                    criticalRoutingSummary.remainingUnroutedCriticalAlertCount
                  )} critical alerts still unrouted.`}
                  tone="warning"
                />
              ) : null}

              <ListCard title="Critical alert routing">
                <div className="admin-detail-stack">
                  <label className="admin-field">
                    <span>Route limit</span>
                    <input
                      aria-label="Critical route limit"
                      inputMode="numeric"
                      value={criticalRouteLimit}
                      onChange={(event) => setCriticalRouteLimit(event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Stale after seconds</span>
                    <input
                      aria-label="Critical route stale after seconds"
                      inputMode="numeric"
                      value={criticalRouteStaleAfterSeconds}
                      onChange={(event) => setCriticalRouteStaleAfterSeconds(event.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    className="admin-secondary-button"
                    disabled={!governedConfirm || mutationPending}
                    onClick={() => routeCriticalMutation.mutate()}
                  >
                    <PendingLabel
                      idle="Route critical alerts"
                      pending={routeCriticalMutation.isPending}
                      pendingLabel="Routing critical alerts..."
                    />
                  </button>
                </div>
              </ListCard>

              {selectedAlert ? (
                <>
                  <label className="admin-field">
                    <span>Owner operator</span>
                    <input
                      aria-label="Alert owner operator"
                      placeholder="ops_e2e"
                      value={ownerOperatorId}
                      onChange={(event) => setOwnerOperatorId(event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Suppress until (ISO)</span>
                    <input
                      aria-label="Alert suppress until"
                      placeholder="2026-04-14T09:30:00.000Z"
                      value={suppressedUntil}
                      onChange={(event) => setSuppressedUntil(event.target.value)}
                    />
                  </label>

                  <div className="admin-action-buttons">
                    <button
                      type="button"
                      className="admin-primary-button"
                      disabled={!governedConfirm || mutationPending || ownerOperatorId.trim().length === 0}
                      onClick={() => assignOwnerMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Assign owner"
                        pending={assignOwnerMutation.isPending}
                        pendingLabel="Assigning owner..."
                      />
                    </button>

                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => acknowledgeMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Acknowledge alert"
                        pending={acknowledgeMutation.isPending}
                        pendingLabel="Acknowledging..."
                      />
                    </button>

                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => routeMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Route to review case"
                        pending={routeMutation.isPending}
                        pendingLabel="Routing..."
                      />
                    </button>

                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => retryMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Retry deliveries"
                        pending={retryMutation.isPending}
                        pendingLabel="Retrying..."
                      />
                    </button>

                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending || suppressedUntil.trim().length === 0}
                      onClick={() => suppressMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Suppress alert"
                        pending={suppressMutation.isPending}
                        pendingLabel="Saving suppression..."
                      />
                    </button>

                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending || !selectedAlert.hasActiveSuppression}
                      onClick={() => clearSuppressionMutation.mutate()}
                    >
                      <PendingLabel
                        idle="Clear suppression"
                        pending={clearSuppressionMutation.isPending}
                        pendingLabel="Clearing suppression..."
                      />
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No alert selected"
                  description="Select an alert to unlock routing, ownership, and suppression controls."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
