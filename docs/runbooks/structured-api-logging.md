# Structured API Logging

This runbook covers the Phase 11 structured API logging baseline.

It provides:
- request correlation through `X-Request-Id`
- structured JSON request completion logs
- structured JSON request failure logs
- actor attribution for customer, operator, worker, and anonymous requests

## Request correlation

Inbound behavior:
- if `X-Request-Id` is present and valid, the API reuses it
- otherwise the API generates a new request id

Outbound behavior:
- the API always returns `X-Request-Id` in the response headers

## Log events

Successful requests write:
- `event = http_request_completed`

Failed requests write:
- `event = http_request_failed`

Startup writes:
- `event = api_started`

Each log payload includes:
- `timestamp`
- `level`
- `service = api`
- `requestId`
- `method`
- `path`
- `routePath`
- `actorType`
- `actorId`
- `actorRole`
- `statusCode`
- `durationMs`

## Operational use

Use structured API logs to:
- trace one failing request across proxies and app logs using `requestId`
- separate customer, operator, and worker traffic during incident response
- confirm whether failures are authorization, validation, or internal errors
- correlate specific operator actions with downstream audit and reconciliation events

## Next observability step

After this logging baseline:
1. attach ownership and escalation targets to the routed metrics and platform alerts
2. add acknowledgement and suppression policy on top of the routed alert surface
