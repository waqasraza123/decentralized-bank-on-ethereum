import { useQuery } from "@tanstack/react-query";
import {
  listPlatformAlertDeliveryTargetHealth,
  listPlatformAlerts,
  listOversightAlerts
} from "@/lib/api";
import { formatCount, formatDateTime } from "@/lib/format";
import { MetricCard, SectionPanel } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function AlertsPage() {
  const { session, fallback } = useConfiguredSessionGuard();

  const platformAlertsQuery = useQuery({
    queryKey: ["platform-alerts", session?.baseUrl],
    queryFn: () => listPlatformAlerts(session!, { limit: 20 }),
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

  if (fallback) {
    return fallback;
  }

  if (
    platformAlertsQuery.isLoading ||
    deliveryHealthQuery.isLoading ||
    oversightAlertsQuery.isLoading
  ) {
    return <p>Loading alerts and incidents...</p>;
  }

  if (
    platformAlertsQuery.isError ||
    deliveryHealthQuery.isError ||
    oversightAlertsQuery.isError
  ) {
    return <p>Failed to load alert state.</p>;
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Alerts and incidents"
        description="Open platform alerts, delivery target health, and oversight alert activity."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Platform alerts"
            value={formatCount(platformAlertsQuery.data!.alerts.length)}
            detail="Current alert list"
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
        title="Platform alerts"
        description="Ownership, escalation, and delivery signal."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {platformAlertsQuery.data!.alerts.map((alert) => (
              <div key={alert.id} className="admin-list-row">
                <strong>{alert.summary}</strong>
                <span>{alert.severity}</span>
                <span>{formatDateTime(alert.lastDetectedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Delivery health"
        description="Notification targets and their recent delivery posture."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {deliveryHealthQuery.data!.targets.map((target) => (
              <div key={target.targetName} className="admin-list-row">
                <strong>{target.targetName}</strong>
                <span>{target.healthStatus}</span>
                <span>{formatCount(target.recentDeliveryCount)} events</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
