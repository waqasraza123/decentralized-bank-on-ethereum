# Platform Alert Routing

This runbook covers the Phase 11 alert-routing automation layered on top of durable platform alerts and the internal metrics surface.

It now also includes the governance controls used after routing:
- explicit owner assignment
- operator acknowledgement
- temporary suppression windows

## Endpoints

Single alert to review case:

```http
POST /operations/internal/alerts/:alertId/route-review-case
Content-Type: application/json

{
  "note": "Optional operator routing note"
}
```

Batch route unrouted critical alerts:

```http
POST /operations/internal/alerts/route-critical
Content-Type: application/json

{
  "limit": 10,
  "staleAfterSeconds": 180,
  "note": "Optional shared routing note"
}
```

Authentication:
- internal operator API key headers are required, the same as the other operations endpoints

Ownership:

```http
POST /operations/internal/alerts/:alertId/assign-owner
Content-Type: application/json

{
  "ownerOperatorId": "ops_17",
  "note": "Optional ownership note"
}
```

Acknowledgement:

```http
POST /operations/internal/alerts/:alertId/acknowledge
Content-Type: application/json

{
  "note": "Optional acknowledgement note"
}
```

Suppression:

```http
POST /operations/internal/alerts/:alertId/suppress
Content-Type: application/json

{
  "suppressedUntil": "2026-04-07T12:30:00.000Z",
  "note": "Optional suppression note"
}
```

Clear suppression:

```http
POST /operations/internal/alerts/:alertId/clear-suppression
Content-Type: application/json

{
  "note": "Optional clear note"
}
```

## Behavior

- only open platform alerts can be routed
- routing creates or reuses a `manual_intervention` review case using a reason code derived from the alert dedupe key
- each routing action writes an audit event against the `PlatformAlert`
- routed state is persisted on the alert so operators can see whether triage already happened
- owner assignment, acknowledgement, and suppression state are also persisted on the alert
- suppression only mutes the operator handling state; it does not resolve the alert
- if a resolved alert later reopens, routing state is reset so the new incident window must be triaged again
- if a resolved alert later reopens, ownership, acknowledgement, and suppression state are reset too
- batch routing only targets open, critical, currently unrouted alerts

## Operational use

Use routed platform alerts to:
- push critical worker, queue, chain, treasury, and reconciliation failures into the operator review queue
- avoid relying on raw logs or ad hoc database queries to prove that triage was opened
- link alert investigation to the existing review-case workflow and audit trail
- make one operator visibly responsible for an active alert
- reduce repeated noise during maintenance or known incidents without losing the durable alert record

## Next step

After this routing baseline:
1. deliver governed platform alerts into external paging or notification targets by category
2. attach richer category-specific escalation automation on top of the existing ownership and suppression controls
