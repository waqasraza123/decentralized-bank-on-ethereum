# Platform Metrics API

This runbook covers the internal Prometheus-style metrics surface added for Phase 11 observability.

## Endpoint

Request:

```http
GET /operations/internal/metrics?staleAfterSeconds=180
```

Authentication:
- internal operator API key headers are required, the same as the other operations endpoints

Response:
- `text/plain; version=0.0.4; charset=utf-8`

## Metric groups

API request metrics:
- `stb_api_http_requests_in_flight`
- `stb_api_http_requests_total`
- `stb_api_http_request_duration_seconds`

Operations snapshot metrics:
- `stb_operations_workers_total`
- `stb_operations_queue_intents_total`
- `stb_operations_queue_aged_total`
- `stb_operations_manual_withdrawal_backlog_total`
- `stb_operations_chain_lagging_broadcasts_total`
- `stb_operations_chain_failed_transactions_recent_total`
- `stb_operations_treasury_wallets_total`
- `stb_operations_managed_wallet_coverage_missing`
- `stb_operations_reconciliation_mismatches_total`
- `stb_operations_reconciliation_failed_scans_recent_total`
- `stb_operations_incident_open_total`
- `stb_platform_alerts_open_total`

Worker execution metrics:
- `stb_worker_runtime_heartbeat_age_seconds`
- `stb_worker_latest_iteration_metric`

## Operational use

Use these metrics to:
- alert on rising API failure rates and latency
- detect stale worker heartbeats without reading raw logs first
- route queue, chain, treasury, and reconciliation pressure into external alerting systems
- monitor the same worker iteration counters already persisted through heartbeat reporting

## Next step

After this metrics baseline and routed-alert automation:
1. document escalation targets and ownership for each critical alert class
2. add acknowledgement and suppression policy so recurring alert noise stays operator-safe
