import { ReactNode } from "react";

type Tone = "neutral" | "positive" | "warning" | "critical" | "technical";

export function SectionPanel({
  title,
  description,
  children,
  action
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>{title}</h2>
          {description ? <p className="admin-copy">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function AdminStatusBadge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span className="admin-status-badge" data-tone={tone}>
      {label}
    </span>
  );
}

export function ListCard({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-list-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="admin-empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
