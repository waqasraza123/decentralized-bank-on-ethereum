# Platform Alert Routing

This runbook covers the Phase 11 alert-routing automation layered on top of durable platform alerts and the internal metrics surface.

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

## Behavior

- only open platform alerts can be routed
- routing creates or reuses a `manual_intervention` review case using a reason code derived from the alert dedupe key
- each routing action writes an audit event against the `PlatformAlert`
- routed state is persisted on the alert so operators can see whether triage already happened
- if a resolved alert later reopens, routing state is reset so the new incident window must be triaged again
- batch routing only targets open, critical, currently unrouted alerts

## Operational use

Use routed platform alerts to:
- push critical worker, queue, chain, treasury, and reconciliation failures into the operator review queue
- avoid relying on raw logs or ad hoc database queries to prove that triage was opened
- link alert investigation to the existing review-case workflow and audit trail

## Next step

After this routing baseline:
1. assign ownership and escalation targets for each critical alert category
2. add acknowledgement and suppression policy so repeated incidents do not create uncontrolled alert noise
