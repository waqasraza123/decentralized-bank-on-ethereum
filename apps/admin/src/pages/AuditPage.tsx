import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAuditEvents } from "@/lib/api";
import { formatDateTime, formatName, shortenValue } from "@/lib/format";
import { SectionPanel } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function AuditPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

  const auditQuery = useQuery({
    queryKey: ["audit-events", session?.baseUrl, deferredSearch],
    queryFn: () => listAuditEvents(session!, { limit: 30, search: deferredSearch || undefined }),
    enabled: Boolean(session)
  });

  if (fallback) {
    return fallback;
  }

  if (auditQuery.isLoading) {
    return <p>Loading audit trail...</p>;
  }

  if (auditQuery.isError) {
    return <p>Failed to load audit trail.</p>;
  }

  return (
    <SectionPanel
      title="Audit trail"
      description="Searchable event history with actor, target, and timestamp prominence."
      action={
        <input
          className="admin-search-input"
          placeholder="Search audit events"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      }
    >
      <div className="admin-list-card">
        <div className="admin-list">
          {auditQuery.data!.events.map((event) => (
            <div key={event.id} className="admin-list-row">
              <strong>{event.action}</strong>
              <span>{event.targetType}</span>
              <span>{shortenValue(event.targetId)}</span>
              <span>
                {event.customer
                  ? formatName(event.customer.firstName, event.customer.lastName)
                  : formatDateTime(event.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionPanel>
  );
}
