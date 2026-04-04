# Customer Account Incident Package Release Workflow API

This runbook covers the formal approval and release workflow for governed customer account incident package exports.

This slice adds a durable lifecycle on top of governed export generation.

## Purpose

Governed export generation is not enough for production-grade distribution.

This workflow adds:

- durable release-request records
- immutable stored artifact payload snapshots
- approval before release
- dual-control approval
- rejection flow
- explicit release action
- expiry for stale approvals
- audit trail for every stage

## Runtime config

The workflow is controlled by:

- `INCIDENT_PACKAGE_RELEASE_APPROVER_ALLOWED_OPERATOR_ROLES`
- `INCIDENT_PACKAGE_RELEASE_APPROVAL_EXPIRY_HOURS`

Defaults:

- approver roles:
  - `compliance_lead`
  - `risk_manager`
- approval expiry:
  - `72` hours

## Stored lifecycle

A release request stores:

- customer account id
- export mode
- release target
- release reason code
- requester identity
- approver identity
- releaser identity
- artifact checksum
- immutable artifact payload snapshot
- timestamps for request, approval, rejection, release, expiry

## Statuses

- `pending_approval`
- `approved`
- `rejected`
- `released`
- `expired`

## Dual control

The requester cannot approve or reject their own release request.

This is enforced by runtime logic.

## Endpoints

### 1. Create release request

POST /customer-account-incident-package/internal/releases

Example body:

{
  "customerAccountId": "account_1",
  "mode": "compliance_focused",
  "releaseTarget": "compliance_handoff",
  "releaseReasonCode": "compliance_review_request",
  "requestNote": "prepare controlled compliance handoff artifact",
  "recentLimit": 20,
  "timelineLimit": 100,
  "sinceDays": 30
}

Behavior:

- generates governed export snapshot
- stores immutable artifact payload
- writes `AuditEvent.action = customer_account.incident_package_release_requested`

### 2. List pending release requests

GET /customer-account-incident-package/internal/releases/pending?limit=20

Optional filters:

- `customerAccountId`
- `requestedByOperatorId`
- `mode`
- `releaseTarget`

### 3. Retrieve one release record

GET /customer-account-incident-package/internal/releases/release_1

Behavior:

- returns stored release record
- resolves expired approval status when applicable

### 4. Approve release request

POST /customer-account-incident-package/internal/releases/release_1/approve

Example body:

{
  "approvalNote": "approved for controlled compliance release"
}

Behavior:

- requires approver role authorization
- blocks self-approval by requester
- sets `status = approved`
- sets `expiresAt`
- writes `AuditEvent.action = customer_account.incident_package_release_approved`

### 5. Reject release request

POST /customer-account-incident-package/internal/releases/release_1/reject

Example body:

{
  "rejectionNote": "redaction scope must be reduced before release"
}

Behavior:

- requires approver role authorization
- blocks self-rejection by requester
- sets `status = rejected`
- writes `AuditEvent.action = customer_account.incident_package_release_rejected`

### 6. Release approved package

POST /customer-account-incident-package/internal/releases/release_1/release

Example body:

{
  "releaseNote": "released into compliance case workflow"
}

Behavior:

- requires approver-role authorization
- requires prior approval
- blocks expired approvals
- sets `status = released`
- writes `AuditEvent.action = customer_account.incident_package_released`

### 7. List released artifacts

GET /customer-account-incident-package/internal/releases/released?limit=20&sinceDays=30

Optional filters:

- `customerAccountId`
- `releasedByOperatorId`
- `mode`
- `releaseTarget`
- `sinceDays`

## Audit actions

This workflow writes:

- `customer_account.incident_package_release_requested`
- `customer_account.incident_package_release_approved`
- `customer_account.incident_package_release_rejected`
- `customer_account.incident_package_released`
- `customer_account.incident_package_release_expired`

## Notes

- this step does not replace governed export generation
- this step wraps governed export generation in a durable release workflow
- this step stores the exact artifact snapshot that was requested for release
- this step is the controlled distribution layer for incident package artifacts
