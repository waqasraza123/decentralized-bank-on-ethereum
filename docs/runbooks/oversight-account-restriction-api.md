# Oversight Account Restriction API

## Purpose

This runbook covers the first risk-hold and restricted-customer escalation slice driven by oversight incidents.

This slice lets operators:

- place a temporary risk hold on a customer account from an oversight incident
- release that hold later
- inspect current account restriction state from the oversight workspace

It also blocks new sensitive transaction-intent requests while the hold is active.

## Authentication

These endpoints require:

- x-operator-api-key
- x-operator-id

## Place an account hold from an oversight incident

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/place-account-hold

Example body:

    {
      "restrictionReasonCode": "oversight_risk_hold",
      "note": "Repeated manual interventions require temporary containment."
    }

Expected behavior:

- allowed only when the oversight incident:
  - exists
  - is not resolved
  - is not dismissed
  - targets a customer account
- allowed only when the target account is not already restricted by another active hold
- updates the customer account:
  - status = restricted
  - restrictedAt
  - restrictedFromStatus
  - restrictionReasonCode
  - restrictedByOperatorId
  - restrictedByOversightIncidentId
- writes:
  - OversightIncidentEvent.eventType = account_restriction_applied
  - AuditEvent.action = customer_account.restricted

## Release an account hold from an oversight incident

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/release-account-hold

Example body:

    {
      "note": "Investigation completed. Hold is no longer required."
    }

Expected behavior:

- allowed only when the account is actively restricted by that same oversight incident
- restores the customer account back to:
  - restrictedFromStatus
  - or registered if no previous status was stored
- updates:
  - restrictionReleasedAt
  - restrictionReleasedByOperatorId
- writes:
  - OversightIncidentEvent.eventType = account_restriction_released
  - AuditEvent.action = customer_account.restriction_released

## Oversight workspace visibility

Endpoint:

    GET /oversight-incidents/internal/:oversightIncidentId/workspace?recentLimit=20

Expected behavior:

- returns:
  - oversight incident details
  - current account restriction state
  - oversight event timeline
  - recent manually resolved intents
  - recent related review cases

## Sensitive request blocking

While a customer account is under an active risk hold:

- POST /transaction-intents/deposit-requests is rejected
- POST /transaction-intents/withdrawal-requests is rejected

Expected behavior:

- blocked accounts cannot create new sensitive transaction-intent requests
- error indicates the account is under a risk hold

## Success condition

A successful risk-hold slice should produce:

- explicit oversight-driven account containment
- clear linkage between the active hold and the oversight incident
- reversible hold release with audit trail
- prevention of new sensitive intent creation while risk containment is active
