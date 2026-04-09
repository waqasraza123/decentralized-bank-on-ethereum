import { useQuery } from "@tanstack/react-query";
import { getTreasuryOverview } from "@/lib/api";
import { formatCount, formatDateTime, shortenValue } from "@/lib/format";
import { MetricCard, SectionPanel } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function TreasuryPage() {
  const { session, fallback } = useConfiguredSessionGuard();

  const treasuryQuery = useQuery({
    queryKey: ["treasury-overview", session?.baseUrl],
    queryFn: () => getTreasuryOverview(session!, { recentLimit: 10 }),
    enabled: Boolean(session)
  });

  if (fallback) {
    return fallback;
  }

  if (treasuryQuery.isLoading) {
    return <p>Loading treasury visibility...</p>;
  }

  if (treasuryQuery.isError) {
    return <p>Failed to load treasury visibility.</p>;
  }

  const treasury = treasuryQuery.data!;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Treasury visibility"
        description="Wallet coverage, operational inventory, and recent treasury-linked activity."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Treasury wallets"
            value={formatCount(treasury.coverage.activeTreasuryWalletCount)}
            detail={`${formatCount(treasury.coverage.activeOperationalWalletCount)} operational`}
          />
          <MetricCard
            label="Linked wallets"
            value={formatCount(treasury.coverage.customerLinkedWalletCount)}
            detail="Wallets attached to a customer account"
          />
          <MetricCard
            label="Treasury alerts"
            value={formatCount(treasury.coverage.openTreasuryAlertCount)}
            detail={`Generated ${formatDateTime(treasury.generatedAt)}`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Wallet inventory"
        description="Managed treasury and operational wallets."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {treasury.wallets.map((wallet) => (
              <div key={wallet.id} className="admin-list-row">
                <strong>{shortenValue(wallet.address)}</strong>
                <span>{wallet.kind}</span>
                <span>{wallet.status}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Recent activity"
        description="Latest treasury-linked customer intents and alerts."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Intents</h3>
            <div className="admin-list">
              {treasury.recentActivity.map((activity) => (
                <div key={activity.transactionIntentId} className="admin-list-row">
                  <strong>{activity.asset.symbol}</strong>
                  <span>{activity.intentType}</span>
                  <span>{activity.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-list-card">
            <h3>Alerts</h3>
            <div className="admin-list">
              {treasury.recentAlerts.map((alert) => (
                <div key={alert.id} className="admin-list-row">
                  <strong>{alert.summary}</strong>
                  <span>{alert.severity}</span>
                  <span>{alert.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
