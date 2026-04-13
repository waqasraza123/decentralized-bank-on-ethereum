import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { listAuditEvents } from "@/lib/api";
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
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import { mapAuditEntriesToTimeline, mapStatusToTone, useConfiguredSessionGuard } from "./shared";

type AuditFilterDraft = {
  search: string;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  customerId: string;
  email: string;
  dateFrom: string;
  dateTo: string;
};

const auditFilterKeys = [
  "search",
  "actorType",
  "actorId",
  "action",
  "targetType",
  "targetId",
  "customerId",
  "email",
  "dateFrom",
  "dateTo"
] as const;

function createAuditFilterDraft(searchParams: URLSearchParams): AuditFilterDraft {
  return {
    search: searchParams.get("search") ?? "",
    actorType: searchParams.get("actorType") ?? "",
    actorId: searchParams.get("actorId") ?? "",
    action: searchParams.get("action") ?? "",
    targetType: searchParams.get("targetType") ?? "",
    targetId: searchParams.get("targetId") ?? "",
    customerId: searchParams.get("customerId") ?? "",
    email: searchParams.get("email") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? ""
  };
}

function buildAuditQueryParams(searchParams: URLSearchParams) {
  const params: Record<string, string | number | undefined> = {
    limit: 30
  };

  for (const key of auditFilterKeys) {
    const value = searchParams.get(key)?.trim();
    params[key] = value && value.length > 0 ? value : undefined;
  }

  return params;
}

function countActiveAuditFilters(filters: AuditFilterDraft): number {
  return auditFilterKeys.reduce((count, key) => {
    return filters[key].trim().length > 0 ? count + 1 : count;
  }, 0);
}

export function AuditPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterDraft, setFilterDraft] = useState<AuditFilterDraft>(() =>
    createAuditFilterDraft(searchParams)
  );
  const selectedEventId = searchParams.get("event");

  const auditQuery = useQuery({
    queryKey: ["audit-events", session?.baseUrl, searchParams.toString()],
    queryFn: () => listAuditEvents(session!, buildAuditQueryParams(searchParams)),
    enabled: Boolean(session)
  });

  useEffect(() => {
    setFilterDraft(createAuditFilterDraft(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const events = auditQuery.data?.events ?? [];

    if (events.length === 0) {
      return;
    }

    const eventExists = events.some((event) => event.id === selectedEventId);

    if (!selectedEventId || !eventExists) {
      const next = new URLSearchParams(searchParams);
      next.set("event", events[0].id);
      setSearchParams(next);
    }
  }, [auditQuery.data, searchParams, selectedEventId, setSearchParams]);

  if (fallback) {
    return fallback;
  }

  if (auditQuery.isLoading) {
    return (
      <LoadingState
        title="Loading audit trail"
        description="Structured event history is loading with actor, target, and timestamp detail."
      />
    );
  }

  if (auditQuery.isError) {
    return (
      <ErrorState
        title="Audit trail unavailable"
        description={readApiErrorMessage(
          auditQuery.error,
          "Audit history could not be loaded for the current operator session."
        )}
      />
    );
  }

  const events = auditQuery.data!.events;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const appliedFilters = createAuditFilterDraft(searchParams);
  const activeFilterCount = countActiveAuditFilters(appliedFilters);

  function applyFilters() {
    const next = new URLSearchParams(searchParams);

    for (const key of auditFilterKeys) {
      const value = filterDraft[key].trim();

      if (value.length > 0) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }

    next.delete("event");
    setSearchParams(next);
  }

  function clearFilters() {
    setFilterDraft(createAuditFilterDraft(new URLSearchParams()));
    setSearchParams(new URLSearchParams());
  }

  function selectEvent(eventId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("event", eventId);
    setSearchParams(next);
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Audit trail"
        description="Searchable event history with actor, target, customer, and timestamp context."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Loaded events"
            value={formatCount(events.length)}
            detail={`${formatCount(auditQuery.data!.totalCount)} total in the current slice`}
          />
          <MetricCard
            label="Active filters"
            value={formatCount(activeFilterCount)}
            detail="Persisted in the audit workspace URL"
          />
          <MetricCard
            label="Selected context"
            value={selectedEvent ? toTitleCase(selectedEvent.action) : "None"}
            detail={selectedEvent ? shortenValue(selectedEvent.targetId) : "No event selected"}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Audit workspace"
        description="Investigate filtered audit slices, inspect event detail, and preserve query context."
      >
        <WorkspaceLayout
          sidebar={
            <ListCard title="Search results">
              {events.length === 0 ? (
                <EmptyState
                  title="No audit events matched"
                  description="Adjust the filters to inspect a different slice of system history."
                />
              ) : (
                <div className="admin-list">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedEvent?.id === event.id ? "selected" : ""
                      }`}
                      onClick={() => selectEvent(event.id)}
                    >
                      <strong>{toTitleCase(event.action)}</strong>
                      <span>{event.actorId ?? event.actorType}</span>
                      <span>{toTitleCase(event.targetType)}</span>
                      <AdminStatusBadge
                        label={formatDateTime(event.createdAt)}
                        tone={mapStatusToTone(event.action)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </ListCard>
          }
          main={
            selectedEvent ? (
              <>
                <ListCard title="Selected event">
                  <DetailList
                    items={[
                      { label: "Event reference", value: selectedEvent.id, mono: true },
                      { label: "Action", value: toTitleCase(selectedEvent.action) },
                      { label: "Actor type", value: toTitleCase(selectedEvent.actorType) },
                      {
                        label: "Actor reference",
                        value: selectedEvent.actorId ?? "system",
                        mono: Boolean(selectedEvent.actorId)
                      },
                      { label: "Target type", value: toTitleCase(selectedEvent.targetType) },
                      {
                        label: "Target reference",
                        value: selectedEvent.targetId ?? "No target",
                        mono: Boolean(selectedEvent.targetId)
                      },
                      {
                        label: "Recorded at",
                        value: formatDateTime(selectedEvent.createdAt)
                      }
                    ]}
                  />
                  {selectedEvent.customer ? (
                    <InlineNotice
                      title="Customer context"
                      description={`${formatName(
                        selectedEvent.customer.firstName,
                        selectedEvent.customer.lastName
                      )} · ${selectedEvent.customer.email ?? "No email"} · ${
                        selectedEvent.customer.customerId
                      }`}
                    />
                  ) : (
                    <InlineNotice
                      title="No customer context"
                      description="This audit event is not directly linked to a resolved customer projection."
                    />
                  )}
                </ListCard>

                <ListCard title="Event metadata">
                  <div className="admin-field">
                    <span>Metadata JSON</span>
                    <textarea
                      aria-label="Selected audit event metadata"
                      className="admin-textarea"
                      readOnly
                      value={JSON.stringify(selectedEvent.metadata, null, 2)}
                    />
                  </div>
                </ListCard>

                <TimelinePanel
                  title="Filtered audit timeline"
                  description="Timeline-first view of the currently loaded audit slice."
                  events={mapAuditEntriesToTimeline(
                    events.map((event) => ({
                      id: event.id,
                      actorType: event.actorType,
                      actorId: event.actorId,
                      action: event.action,
                      targetType: event.targetType,
                      targetId: event.targetId,
                      metadata: event.metadata,
                      createdAt: event.createdAt
                    }))
                  )}
                  emptyState={{
                    title: "No timeline events",
                    description:
                      "Filtered audit history will render here when matching events are available."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select an event"
                description="Choose an audit result to inspect actor, target, and metadata detail."
              />
            )
          }
          rail={
            <ActionRail
              title="Audit filters"
              description="Apply structured filters and keep the resulting workspace URL-shareable."
            >
              <div className="admin-field">
                <span>Search</span>
                <input
                  aria-label="Audit search"
                  placeholder="alert, release, customer, or reference"
                  value={filterDraft.search}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      search: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Actor type</span>
                <input
                  aria-label="Audit actor type"
                  placeholder="operator"
                  value={filterDraft.actorType}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      actorType: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Actor reference</span>
                <input
                  aria-label="Audit actor ID"
                  placeholder="ops_e2e"
                  value={filterDraft.actorId}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      actorId: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Action</span>
                <input
                  aria-label="Audit action"
                  placeholder="customer_account.incident_package_release_approved"
                  value={filterDraft.action}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      action: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Target type</span>
                <input
                  aria-label="Audit target type"
                  placeholder="CustomerAccountIncidentPackageRelease"
                  value={filterDraft.targetType}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      targetType: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Target reference</span>
                <input
                  aria-label="Audit target ID"
                  placeholder="incident_package_release_1"
                  value={filterDraft.targetId}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      targetId: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Customer reference</span>
                <input
                  aria-label="Audit customer ID"
                  placeholder="customer_1"
                  value={filterDraft.customerId}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      customerId: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Customer email</span>
                <input
                  aria-label="Audit customer email"
                  placeholder="amina@example.com"
                  value={filterDraft.email}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      email: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Date from</span>
                <input
                  aria-label="Audit date from"
                  placeholder="2026-04-01T00:00:00.000Z"
                  value={filterDraft.dateFrom}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      dateFrom: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Date to</span>
                <input
                  aria-label="Audit date to"
                  placeholder="2026-04-30T23:59:59.000Z"
                  value={filterDraft.dateTo}
                  onChange={(event) =>
                    setFilterDraft((current) => ({
                      ...current,
                      dateTo: event.target.value
                    }))
                  }
                />
              </div>

              {activeFilterCount > 0 ? (
                <InlineNotice
                  title="Applied filter summary"
                  description={`${formatCount(
                    activeFilterCount
                  )} active filters are shaping this audit slice.`}
                  tone="technical"
                />
              ) : null}

              <div className="admin-action-buttons">
                <button
                  type="button"
                  className="admin-primary-button"
                  onClick={applyFilters}
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
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
