# Customer Account Incident Package Export Governance API

This runbook covers the governed export layer for customer account incident packages.

It adds three export modes on top of the existing incident package JSON and markdown flow:

- `internal_full`
- `redaction_ready`
- `compliance_focused`

It also adds:

- runtime-config-backed limit controls
- time-window controls
- export accountability metadata
- explicit export audit events

## Purpose

This slice formalizes how the incident package is exported for operator, governance, and compliance workflows.

The existing package already contains:

- customer account operations timeline
- recent transaction intents
- review cases
- oversight incidents
- account hold records
- release-review context

This step makes that package safer and more operationally explainable for downstream export use.

## Runtime config

These runtime env vars control the governed export surface:

- `INCIDENT_PACKAGE_EXPORT_MAX_RECENT_LIMIT`
- `INCIDENT_PACKAGE_EXPORT_MAX_TIMELINE_LIMIT`
- `INCIDENT_PACKAGE_EXPORT_MAX_SINCE_DAYS`

Default behavior:

- recent records are clamped to a safe maximum
- timeline records are clamped to a safe maximum
- `sinceDays` is clamped to a safe maximum when provided

## Endpoints

### 1. Governed JSON export

GET /customer-account-incident-package/internal/export?customerAccountId=account_1&mode=internal_full&recentLimit=20&timelineLimit=100

GET /customer-account-incident-package/internal/export?supabaseUserId=supabase_1&mode=redaction_ready&sinceDays=30

### 2. Governed markdown export

GET /customer-account-incident-package/internal/export/markdown?customerAccountId=account_1&mode=compliance_focused&recentLimit=20&timelineLimit=100&sinceDays=30

## Required headers

Same internal operator headers as the existing internal governance APIs:

- `x-operator-api-key`
- `x-operator-id`
- `x-operator-role`

## Export modes

### `internal_full`

Use when the export is staying fully inside internal operator workflows.

Behavior:

- preserves the package structure
- keeps internal identifiers visible
- writes export accountability metadata
- writes an audit event

### `redaction_ready`

Use when the package may leave the immediate operator workflow and should be prepared for downstream sharing or review.

Behavior:

- masks email
- masks Supabase user id
- masks operator ids
- masks wallet addresses
- masks tx hashes
- recursively redacts timeline metadata where applicable
- writes export accountability metadata
- writes an audit event

### `compliance_focused`

Use when the export should emphasize control posture, material incidents, and structured governance facts over raw operational detail.

Behavior:

- returns a curated package focused on:
  - account status
  - current restriction posture
  - balances
  - counts
  - recent in-scope intents
  - restrictions
  - review cases
  - oversight incidents
  - material timeline events
  - compliance summary
- writes export accountability metadata
- writes an audit event

## Audit event

Every governed export writes:

- `AuditEvent.action = customer_account.incident_package_exported`

Metadata includes:

- export mode
- generated time
- operator id
- operator role
- redaction flag
- requested and applied limits
- requested and applied time window
- export checksum
- in-scope record counts

## Response shape

Governed JSON export returns:

- `exportMetadata`
- `complianceSummary`
- `narrative`
- `package`

## Example operator workflow

1. Operator identifies the customer account under investigation.
2. Operator generates an `internal_full` export during active investigation.
3. Operator generates a `redaction_ready` export when a sanitized artifact is needed.
4. Operator generates a `compliance_focused` markdown export when handing off to compliance or control review.
5. Audit event confirms exactly who exported what, when, and under which governed mode.

## Notes

- this step does not remove or replace the existing incident package JSON endpoint
- this step does not remove or replace the existing incident package markdown endpoint
- this step adds governed export paths beside the existing package surface
- this step intentionally uses `AuditEvent` for accountability instead of introducing a new export log table first
