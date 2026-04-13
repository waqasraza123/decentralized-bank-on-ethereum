import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getTreasuryOverview } from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  formatName,
  readApiErrorMessage,
  shortenValue,
  toTitleCase
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
  MetricCard,
  SectionPanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

type TreasuryScopeDraft = {
  walletLimit: string;
  activityLimit: string;
  alertLimit: string;
  staleAfterSeconds: string;
};

function readPositiveInteger(value: string | null, fallback: number): string {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : String(fallback);
}

function readPositiveIntegerValue(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function createTreasuryScopeDraft(searchParams?: URLSearchParams): TreasuryScopeDraft {
  return {
    walletLimit: readPositiveInteger(searchParams?.get("walletLimit") ?? null, 12),
    activityLimit: readPositiveInteger(searchParams?.get("activityLimit") ?? null, 12),
    alertLimit: readPositiveInteger(searchParams?.get("alertLimit") ?? null, 8),
    staleAfterSeconds: readPositiveInteger(
      searchParams?.get("staleAfterSeconds") ?? null,
      300
    )
  };
}

function applyTreasuryScopeParams(
  params: URLSearchParams,
  scope: TreasuryScopeDraft
): URLSearchParams {
  const next = new URLSearchParams(params);

  next.set("walletLimit", scope.walletLimit);
  next.set("activityLimit", scope.activityLimit);
  next.set("alertLimit", scope.alertLimit);
  next.set("staleAfterSeconds", scope.staleAfterSeconds);

  return next;
}

export function TreasuryPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scopeDraft, setScopeDraft] = useState<TreasuryScopeDraft>(() =>
    createTreasuryScopeDraft(searchParams)
  );
  const [scopeError, setScopeError] = useState<string | null>(null);
  const selectedWalletId = searchParams.get("wallet");
  const selectedActivityId = searchParams.get("activity");

  const treasuryQuery = useQuery({
    queryKey: ["treasury-overview", session?.baseUrl, searchParams.toString()],
    queryFn: () =>
      getTreasuryOverview(session!, {
        walletLimit: readPositiveIntegerValue(
          searchParams.get("walletLimit") ?? scopeDraft.walletLimit
        ),
        activityLimit: readPositiveIntegerValue(
          searchParams.get("activityLimit") ?? scopeDraft.activityLimit
        ),
        alertLimit: readPositiveIntegerValue(
          searchParams.get("alertLimit") ?? scopeDraft.alertLimit
        ),
        staleAfterSeconds: readPositiveIntegerValue(
          searchParams.get("staleAfterSeconds") ?? scopeDraft.staleAfterSeconds
        )
      }),
    enabled: Boolean(session)
  });

  useEffect(() => {
    setScopeDraft(createTreasuryScopeDraft(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const treasury = treasuryQuery.data;

    if (!treasury) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (!selectedWalletId && treasury.wallets[0]?.id) {
      next.set("wallet", treasury.wallets[0].id);
      changed = true;
    }

    const selectedWallet =
      treasury.wallets.find((wallet) => wallet.id === selectedWalletId) ?? treasury.wallets[0];
    const walletActivities = treasury.recentActivity.filter((activity) => {
      if (!selectedWallet) {
        return true;
      }

      return (
        activity.sourceWallet?.id === selectedWallet.id ||
        activity.destinationWallet?.id === selectedWallet.id
      );
    });

    const selectedActivityExists = walletActivities.some(
      (activity) => activity.transactionIntentId === selectedActivityId
    );

    if (walletActivities.length > 0 && (!selectedActivityId || !selectedActivityExists)) {
      next.set("activity", walletActivities[0].transactionIntentId);
      changed = true;
    }

    if (walletActivities.length === 0 && selectedActivityId) {
      next.delete("activity");
      changed = true;
    }

    if (changed) {
      setSearchParams(next);
    }
  }, [
    searchParams,
    selectedActivityId,
    selectedWalletId,
    setSearchParams,
    treasuryQuery.data
  ]);

  if (fallback) {
    return fallback;
  }

  if (treasuryQuery.isLoading) {
    return (
      <LoadingState
        title="Loading treasury visibility"
        description="Wallet coverage, worker posture, and treasury-linked activity are loading."
      />
    );
  }

  if (treasuryQuery.isError) {
    return (
      <ErrorState
        title="Treasury visibility unavailable"
        description={readApiErrorMessage(
          treasuryQuery.error,
          "Treasury coverage and wallet inventory could not be loaded."
        )}
      />
    );
  }

  const treasury = treasuryQuery.data!;
  const selectedWallet =
    treasury.wallets.find((wallet) => wallet.id === selectedWalletId) ?? treasury.wallets[0] ?? null;
  const walletActivities = treasury.recentActivity.filter((activity) => {
    if (!selectedWallet) {
      return true;
    }

    return (
      activity.sourceWallet?.id === selectedWallet.id ||
      activity.destinationWallet?.id === selectedWallet.id
    );
  });
  const selectedActivity =
    walletActivities.find((activity) => activity.transactionIntentId === selectedActivityId) ??
    walletActivities[0] ??
    null;

  function updateSearchParam(key: "wallet" | "activity", value: string | null) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    setSearchParams(next);
  }

  function applyScope() {
    try {
      const next = applyTreasuryScopeParams(searchParams, {
        walletLimit: String(readPositiveIntegerValue(scopeDraft.walletLimit)),
        activityLimit: String(readPositiveIntegerValue(scopeDraft.activityLimit)),
        alertLimit: String(readPositiveIntegerValue(scopeDraft.alertLimit)),
        staleAfterSeconds: String(readPositiveIntegerValue(scopeDraft.staleAfterSeconds))
      });

      setScopeError(null);
      setSearchParams(next);
    } catch {
      setScopeError("Treasury limits must be positive integers.");
    }
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Treasury visibility"
        description="Wallet coverage, managed-worker posture, and treasury-linked activity."
      >
        <InlineNotice
          title="Coverage posture"
          description={`Coverage is ${toTitleCase(
            treasury.coverage.status
          )}. Generated ${formatDateTime(treasury.generatedAt)}.`}
          tone={mapStatusToTone(treasury.coverage.status)}
        />
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Treasury wallets"
            value={formatCount(treasury.coverage.activeTreasuryWalletCount)}
            detail={`${formatCount(treasury.coverage.activeOperationalWalletCount)} operational`}
          />
          <MetricCard
            label="Managed workers"
            value={formatCount(treasury.coverage.managedWorkerCount)}
            detail={`${formatCount(
              treasury.coverage.degradedManagedWorkerCount +
                treasury.coverage.staleManagedWorkerCount
            )} degraded or stale`}
          />
          <MetricCard
            label="Treasury alerts"
            value={formatCount(treasury.coverage.openTreasuryAlertCount)}
            detail={`${formatCount(
              treasury.recentAlerts.length
            )} recent alerts in the loaded view`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Treasury workspace"
        description="Inspect managed workers, wallet assignments, and treasury-linked activity from a single operator view."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Managed workers">
                {treasury.managedWorkers.length === 0 ? (
                  <EmptyState
                    title="No managed workers"
                    description="Treasury worker health will appear here when managed runtimes are configured."
                  />
                ) : (
                  <div className="admin-list">
                    {treasury.managedWorkers.map((worker) => (
                      <div key={worker.workerId} className="admin-list-row">
                        <strong>{worker.workerId}</strong>
                        <span>{worker.environment}</span>
                        <span>{worker.lastIterationStatus}</span>
                        <AdminStatusBadge
                          label={toTitleCase(worker.healthStatus)}
                          tone={mapStatusToTone(worker.healthStatus)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ListCard>

              <ListCard title="Wallet inventory">
                {treasury.wallets.length === 0 ? (
                  <EmptyState
                    title="No wallets loaded"
                    description="Increase the wallet limit or recheck the treasury data source."
                  />
                ) : (
                  <div className="admin-list">
                    {treasury.wallets.map((wallet) => (
                      <button
                        key={wallet.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedWallet?.id === wallet.id ? "selected" : ""
                        }`}
                        onClick={() => updateSearchParam("wallet", wallet.id)}
                      >
                        <strong>{shortenValue(wallet.address)}</strong>
                        <span>{toTitleCase(wallet.kind)}</span>
                        <span>{toTitleCase(wallet.custodyType)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(wallet.status)}
                          tone={mapStatusToTone(wallet.status)}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </ListCard>
            </>
          }
          main={
            selectedWallet ? (
              <>
                <ListCard title="Selected wallet">
                  <DetailList
                    items={[
                      { label: "Wallet reference", value: selectedWallet.id, mono: true },
                      { label: "Address", value: selectedWallet.address, mono: true },
                      { label: "Chain ID", value: String(selectedWallet.chainId) },
                      { label: "Kind", value: toTitleCase(selectedWallet.kind) },
                      { label: "Custody", value: toTitleCase(selectedWallet.custodyType) },
                      {
                        label: "Recent intents",
                        value: formatCount(selectedWallet.recentIntentCount)
                      },
                      {
                        label: "Last activity",
                        value: formatDateTime(selectedWallet.lastActivityAt)
                      },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedWallet.status)}
                            tone={mapStatusToTone(selectedWallet.status)}
                          />
                        )
                      }
                    ]}
                  />
                  {selectedWallet.customerAssignment ? (
                    <InlineNotice
                      title="Customer assignment"
                      description={`${formatName(
                        selectedWallet.customerAssignment.firstName,
                        selectedWallet.customerAssignment.lastName
                      )} · ${
                        selectedWallet.customerAssignment.email ?? "No email"
                      } · ${selectedWallet.customerAssignment.customerAccountId}`}
                      tone={mapStatusToTone(selectedWallet.customerAssignment.accountStatus)}
                    />
                  ) : (
                    <InlineNotice
                      title="Unassigned treasury wallet"
                      description="This wallet is not currently attached to a customer-account assignment."
                    />
                  )}
                </ListCard>

                <ListCard title="Wallet activity">
                  {walletActivities.length === 0 ? (
                    <EmptyState
                      title="No activity for this wallet"
                      description="Recent treasury-linked intents touching this wallet will appear here."
                    />
                  ) : (
                    <div className="admin-list">
                      {walletActivities.map((activity) => (
                        <button
                          key={activity.transactionIntentId}
                          type="button"
                          className={`admin-list-row selectable ${
                            selectedActivity?.transactionIntentId === activity.transactionIntentId
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            updateSearchParam("activity", activity.transactionIntentId)
                          }
                        >
                          <strong>{activity.asset.symbol}</strong>
                          <span>{toTitleCase(activity.intentType)}</span>
                          <span>{activity.requestedAmount}</span>
                          <AdminStatusBadge
                            label={toTitleCase(activity.status)}
                            tone={mapStatusToTone(activity.status)}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </ListCard>

                {selectedActivity ? (
                  <ListCard title="Selected treasury activity">
                    <DetailList
                      items={[
                        {
                          label: "Intent reference",
                          value: selectedActivity.transactionIntentId,
                          mono: true
                        },
                        { label: "Asset", value: selectedActivity.asset.symbol },
                        { label: "Intent type", value: toTitleCase(selectedActivity.intentType) },
                        { label: "Requested amount", value: selectedActivity.requestedAmount },
                        {
                          label: "Settled amount",
                          value: selectedActivity.settledAmount ?? "Pending"
                        },
                        {
                          label: "Policy decision",
                          value: toTitleCase(selectedActivity.policyDecision)
                        },
                        {
                          label: "External address",
                          value: selectedActivity.externalAddress ?? "Managed flow"
                        },
                        {
                          label: "Updated",
                          value: formatDateTime(selectedActivity.updatedAt)
                        }
                      ]}
                    />
                  </ListCard>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="Select a wallet"
                description="Choose a treasury or operational wallet to inspect its assignment and recent activity."
              />
            )
          }
          rail={
            <>
              <ActionRail
                title="Visibility scope"
                description="Tune the loaded treasury view without leaving the workspace."
              >
                <div className="admin-field">
                  <span>Wallet limit</span>
                  <input
                    aria-label="Treasury wallet limit"
                    inputMode="numeric"
                    value={scopeDraft.walletLimit}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        walletLimit: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Activity limit</span>
                  <input
                    aria-label="Treasury activity limit"
                    inputMode="numeric"
                    value={scopeDraft.activityLimit}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        activityLimit: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Alert limit</span>
                  <input
                    aria-label="Treasury alert limit"
                    inputMode="numeric"
                    value={scopeDraft.alertLimit}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        alertLimit: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Worker stale-after seconds</span>
                  <input
                    aria-label="Treasury stale-after seconds"
                    inputMode="numeric"
                    value={scopeDraft.staleAfterSeconds}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        staleAfterSeconds: event.target.value
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
                    onClick={applyScope}
                  >
                    Apply visibility scope
                  </button>
                </div>
              </ActionRail>

              <ActionRail
                title="Recent treasury alerts"
                description="Latest treasury-linked alerts included in the current scope."
              >
                {treasury.recentAlerts.length === 0 ? (
                  <EmptyState
                    title="No treasury alerts"
                    description="Recent treasury-linked alerts will appear here when present."
                  />
                ) : (
                  <div className="admin-list">
                    {treasury.recentAlerts.map((alert) => (
                      <div key={alert.id} className="admin-list-row">
                        <strong>{alert.summary}</strong>
                        <span>{toTitleCase(alert.severity)}</span>
                        <span>{formatDateTime(alert.lastDetectedAt)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(alert.status)}
                          tone={mapStatusToTone(alert.status)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ActionRail>
            </>
          }
        />
      </SectionPanel>
    </div>
  );
}
