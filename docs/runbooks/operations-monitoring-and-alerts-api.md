# Operations Monitoring And Alerts API

This runbook covers the Phase 11 platform health surface exposed through the internal operations monitoring API and the admin console.

It is the operator entry point for:
- worker heartbeat health
- queue backlog health
- chain confirmation lag
- treasury wallet boundary coverage
- ledger reconciliation scan failures and mismatch backlog
- durable platform alerts tied to those signals

## Status snapshot

Request:

```http
GET /operations/internal/status?staleAfterSeconds=180&recentAlertLimit=8
```

Response shape:
- `generatedAt`
- `alertSummary`
- `workerHealth`
- `queueHealth`
- `chainHealth`
- `treasuryHealth`
- `reconciliationHealth`
- `incidentSafety`
- `recentAlerts`

Operational meaning:
- `workerHealth` shows whether the runtime is healthy, degraded, stale, or absent
- `queueHealth` shows queued intent backlog and manual withdrawal backlog
- `chainHealth` shows lagging broadcasts and recent failed blockchain transactions
- `treasuryHealth` shows whether managed execution has the required treasury and operational wallet coverage
- `reconciliationHealth` shows failed scan history and open mismatch pressure

## Durable alert feed

Request:

```http
GET /operations/internal/alerts?status=open&limit=20
```

Alert fields:
- `category`
- `severity`
- `status`
- `code`
- `summary`
- `detail`
- `metadata`
- `firstDetectedAt`
- `lastDetectedAt`
- `resolvedAt`

Alert lifecycle:
1. the monitoring service derives current platform risks from persisted worker, queue, chain, treasury, and reconciliation state
2. matching alert records are opened or refreshed by `dedupeKey`
3. alerts that are no longer active are marked `resolved`

## Worker heartbeat path

Workers report heartbeats here:

```http
POST /operations/internal/worker/heartbeat
```

Heartbeat payload captures:
- runtime environment and execution mode
- last iteration status and timing
- last reconciliation scan status
- runtime metadata
- latest iteration metrics

## Response expectations

Healthy operating envelope:
- at least one worker heartbeat is current
- no stale workers
- no critical reconciliation mismatches
- no recent failed reconciliation scans
- queue backlog remains below warning thresholds
- broadcast confirmations are not materially delayed
- managed execution has active treasury and operational wallets

Operator action triggers:
- stale or absent workers
- repeated worker iteration failures
- growing queued intent backlog
- manual withdrawal backlog in managed mode
- lagging broadcast confirmations
- failed reconciliation scans
- open critical mismatches
- missing managed treasury wallet coverage
