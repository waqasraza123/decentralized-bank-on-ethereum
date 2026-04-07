# Platform Alert Delivery Targets

This runbook covers the external delivery slice for governed platform alerts.

## Runtime configuration

Environment variables:

- `PLATFORM_ALERT_DELIVERY_TARGETS_JSON`
- `PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS`

Example:

```json
[
  {
    "name": "ops-critical",
    "url": "https://ops.example.com/hooks/platform-alerts",
    "bearerToken": "replace-me",
    "categories": ["worker", "queue", "chain", "treasury", "reconciliation"],
    "minimumSeverity": "critical",
    "eventTypes": ["opened", "reopened", "routed_to_review_case", "owner_assigned"]
  }
]
```

Behavior:

- targets are matched by alert category
- targets are matched by minimum severity
- targets are matched by event type
- deliveries are stored durably before send attempts start
- failed deliveries can be retried from the operator API

## Delivery records

Each matched delivery becomes a durable `PlatformAlertDelivery` record with:

- target name
- target url
- event type
- request payload
- attempt count
- final status
- latest response status or error message

## Operational use

Use external delivery targets to:

- page or notify external systems when critical alert classes open or reopen
- prove whether an alert was actually sent to an external target
- retry failed external notifications without mutating the underlying alert state

## Next step

After this delivery-target baseline:
1. add secondary and failover escalation policy for critical delivery targets
2. expand category-specific downstream incident automation on top of the delivered alert stream
