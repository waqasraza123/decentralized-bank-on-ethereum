# Review Case Manual Intervention API

## Purpose

This runbook covers the governance and reporting layer for manual intervention from ReviewCase.

This slice adds:

- privileged operator-role policy for manual resolution
- direct reporting metadata on TransactionIntent
- reporting APIs for manually resolved intents and review cases
- summary reporting by reason code, operator, and intent type

This slice does not expand the safe boundary of what can be manually resolved.

## Authentication

These endpoints require:

- x-operator-api-key
- x-operator-id

For manual resolution execution, the request should also provide:

- x-operator-role

## Runtime policy

Manual resolution still requires the linked transaction intent to already be in a terminal non-money-truth runtime state.

In this slice, that means:

- failed
- cancelled

Manual resolution is not allowed for:

- requested
- review_required
- approved
- queued
- broadcast
- confirmed
- settled

In addition, the acting operator role must be authorized.

Runtime config:

- MANUAL_RESOLUTION_ALLOWED_OPERATOR_ROLES

Default allowed roles:

- operations_admin
- risk_manager
- senior_operator

## Get caller-aware manual resolution eligibility

Endpoint:

    GET /review-cases/internal/:reviewCaseId/manual-resolution-eligibility

Expected behavior:

- returns whether the linked case is:
  - state-eligible
  - caller-authorized
- includes:
  - eligible
  - reasonCode
  - reason
  - currentIntentStatus
  - currentReviewCaseStatus
  - currentReviewCaseType
  - recommendedAction
  - operatorRole
  - operatorAuthorized
  - allowedOperatorRoles

## Apply manual resolution

Endpoint:

    POST /review-cases/internal/:reviewCaseId/apply-manual-resolution

Required headers:

- x-operator-api-key
- x-operator-id
- x-operator-role

Example body:

    {
      "manualResolutionReasonCode": "support_case_closed",
      "note": "Handled off-platform after customer support follow-up."
    }

Expected behavior:

- requires the linked review case to exist
- requires the linked intent to be state-eligible
- requires the caller role to be allowed
- updates the linked transaction intent:
  - status = manually_resolved
  - manuallyResolvedAt
  - manualResolutionReasonCode
  - manualResolutionNote
  - manualResolvedByOperatorId
  - manualResolutionOperatorRole
  - manualResolutionReviewCaseId
- resolves the linked review case
- writes:
  - ReviewCaseEvent.eventType = manual_resolution_applied
  - ReviewCaseEvent.eventType = resolved
  - AuditEvent.action = transaction_intent.manually_resolved
  - AuditEvent.action = review_case.resolved

## Workspace visibility

The review case workspace now includes caller-aware manual resolution eligibility.

Endpoint:

    GET /review-cases/internal/:reviewCaseId/workspace?recentLimit=20

The current operator role is taken from the request context.

## List manually resolved intents

Endpoint:

    GET /review-cases/internal/manual-resolutions/intents?limit=20

Useful filters:

- intentType
- customerAccountId
- supabaseUserId
- email
- manualResolutionReasonCode
- manualResolvedByOperatorId

Expected behavior:

- returns manually resolved intents newest first by manuallyResolvedAt
- includes:
  - customer identity context
  - asset context
  - wallet and external address context
  - manual resolution reason and note
  - manual resolver operator id and role
  - source review case id
  - latest blockchain transaction when present

## List manually resolved review cases

Endpoint:

    GET /review-cases/internal/manual-resolutions/review-cases?limit=20

Useful filters:

- type
- assignedOperatorId
- manualResolutionReasonCode
- manualResolvedByOperatorId
- email

Expected behavior:

- returns resolved review cases linked to manually resolved intents
- includes:
  - review case summary
  - customer summary
  - linked manually resolved transaction intent details

## Manual resolution summary

Endpoint:

    GET /review-cases/internal/manual-resolutions/summary?sinceDays=30

Useful filters:

- sinceDays
- intentType
- manualResolutionReasonCode
- manualResolvedByOperatorId

Expected behavior:

- returns:
  - totalIntents
  - counts by intentType
  - counts by manualResolutionReasonCode
  - counts by manualResolvedByOperatorId and operator role

## Success condition

A successful governance and reporting slice should produce:

- strict privileged-role control over manual intervention
- durable reporting metadata on the transaction intent itself
- one reporting surface for manually resolved intents
- one reporting surface for manually resolved review cases
- one summary surface for manual intervention governance trends
- better operator accountability without relaxing the safety boundary
