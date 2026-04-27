# Solvency Policy Resume Timelock

This runbook covers the governed timelock on manual solvency policy resume.

The timelock prevents an operator from requesting and immediately approving resumed money-sensitive flows after a critical solvency pause. It is enforced by the API and displayed in the admin solvency workspace.

## Runtime Configuration

```bash
SOLVENCY_RESUME_APPROVAL_TIMELOCK_SECONDS=900
```

Default: `900` seconds.

Allowed range: `0` to `86400` seconds.

Set the value to `0` only for local development or explicitly approved emergency operating procedures. Production environments should keep a non-zero delay so pause recovery has a real cooling-off window.

## Request Flow

1. A solvency snapshot detects a critical risk and moves policy to `paused`.
2. A later healthy signed snapshot clears the critical condition but leaves `manualResumeRequired = true`.
3. An authorized requester creates a resume request with:
   - the healthy snapshot id
   - the expected policy `updatedAt`
   - an optional request note
4. The API computes:
   - `approvalEligibleAt = requestedAt + SOLVENCY_RESUME_APPROVAL_TIMELOCK_SECONDS`
   - `approvalTimelockRemainingSeconds`

The workspace response exposes the configured delay through `resumeGovernance.approvalTimelockSeconds`.

## Approval Enforcement

Approvers must still satisfy the existing controls:

- request must be `pending_approval`
- approver must be different from requester
- approver role must be allowed by `SOLVENCY_RESUME_APPROVER_ALLOWED_OPERATOR_ROLES`
- policy must still match `expectedPolicyUpdatedAt`
- policy must still be `paused`
- bound snapshot must still be healthy
- bound snapshot must still have a signed solvency report

The timelock adds one more invariant:

- current time must be greater than or equal to `approvalEligibleAt`

If approval happens too early, the API returns a conflict with the exact ISO timestamp at which approval becomes eligible.

## Admin Console Behavior

The Solvency page shows:

- configured resume approval timelock
- pending request id
- bound snapshot id
- approval eligibility timestamp
- remaining timelock duration

The approve button is disabled while `approvalTimelockRemainingSeconds > 0`.

## Audit Metadata

Resume request audit events include:

- `approvalEligibleAt`
- `approvalTimelockSeconds`

Resume approval audit events and policy metadata also include:

- `approvalEligibleAt`
- `approvalTimelockSeconds`

This allows operators to prove that a policy resume was delayed by the configured control window.

## Safety Invariants

- timelock enforcement lives in the API, not only in the admin UI
- existing dual-control requester/approver separation remains required
- healthy signed snapshot evidence remains required at approval time
- policy changes invalidate stale resume requests before approval
- the delay uses persisted `requestedAt`, so no schema migration is required
