# Audit Log API

This runbook covers the internal operator audit-log surface for cross-domain investigations.

It exists so operators can inspect durable `AuditEvent` records without falling back to raw database queries.

## List audit events

Request:

```http
GET /audit-events/internal?limit=20&search=review_1&actorType=operator&targetType=ReviewCase
```

Supported filters:
- `limit`
- `search`
- `customerId`
- `email`
- `actorType`
- `actorId`
- `action`
- `targetType`
- `targetId`
- `dateFrom`
- `dateTo`

Response shape:
- `events`
- `limit`
- `totalCount`
- `filters`

Each event returns:
- audit event identity and timestamp
- actor type and actor id
- action
- target type and target id
- linked customer context when available
- raw metadata payload

## Operational use

Use this surface when:
- reviewing cross-domain operator actions
- tracing a customer investigation across review, oversight, and release flows
- correlating worker execution with downstream operator actions
- validating that a repair, replay, or governance action wrote durable evidence

Use focused filters first:
1. narrow by `targetType` and `targetId` for one object investigation
2. narrow by `actorType` and `actorId` for operator or worker accountability
3. add `search` or `email` when the exact target id is not yet known
4. constrain by `dateFrom` and `dateTo` for incident windows
