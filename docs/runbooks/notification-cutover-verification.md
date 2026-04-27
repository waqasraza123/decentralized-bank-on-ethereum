# Notification Cutover Verification

## Purpose

Use this runbook to prove the unified notification cutover is live in `staging`, `production_like`, or `production` before governed launch approval.

This proof verifies API behavior only. It does not replace broader browser or mobile smoke coverage, but it gives release-readiness a durable, repeatable gate for the notification surfaces shared by web, admin, and mobile clients.

## What The Probe Verifies

- customer notification feed reads through `GET /notifications/me`
- customer unread summary reads through `GET /notifications/me/unread-count`
- customer preference matrix reads through `GET /notifications/me/preferences`
- customer websocket resume session issuance works through `POST /notifications/me/socket-session`
- operator notification feed reads through `GET /notifications/internal/me`
- operator unread summary reads through `GET /notifications/internal/me/unread-count`
- operator preference matrix reads through `GET /notifications/internal/me/preferences`
- operator websocket resume session issuance works through `POST /notifications/internal/me/socket-session`

The probe stores socket-session proof without persisting bearer tokens or websocket tokens. Evidence payloads record only booleans, sequence numbers, recipient keys, timestamps, counters, supported channels, and sample feed metadata.

## Required Inputs

- accepted environment: `staging`, `production_like`, or `production`
- API base URL for that environment
- launch release identifier
- requester operator id and role
- fresh operator bearer token
- fresh customer JWT for the launch smoke customer
- optional launch smoke notification item for both customer and operator feeds

## Command

```bash
pnpm release:readiness:probe -- \
  --probe notification_cutover_verification \
  --base-url https://prodlike-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --customer-access-token "$CUSTOMER_ACCESS_TOKEN" \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --record-evidence
```

If the launch smoke flow intentionally emits at least one customer and one operator notification before verification, require the probe to observe those feed items:

```bash
pnpm release:readiness:probe -- \
  --probe notification_cutover_verification \
  --base-url https://prodlike-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --customer-access-token "$CUSTOMER_ACCESS_TOKEN" \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --require-notification-feed-item \
  --record-evidence
```

## Acceptance Criteria

- probe exits successfully
- release-readiness evidence is recorded as `passed`
- evidence type is `notification_cutover_verification`
- evidence environment is `staging`, `production_like`, or `production`
- evidence release identifier matches the governed launch request
- customer and operator preference matrices expose at least `in_app` and `email`
- customer and operator websocket sessions issue non-empty tokens with future expirations and non-stale latest sequence values

## Failure Handling

- Missing customer token: reissue a fresh launch smoke customer JWT and rerun.
- Empty preference matrix: confirm notification preferences were backfilled for the recipient audience.
- Socket latest sequence behind feed: inspect `NotificationRecipientState` and feed-item sequence persistence before recording evidence.
- Expired socket session: check API clock skew and session lifetime configuration before rerunning.
- Missing feed item with `--require-notification-feed-item`: rerun the launch smoke action that emits customer and operator notifications, then rerun the probe.
