# ADR 005: Auth and Account Lifecycle

- Status: Accepted
- Date: 2026-03-28

## Context

The current repository uses Supabase for authentication but also mixes business-user state across Supabase and Prisma in ways that are not yet cleanly modeled.

That is not sufficient for a production financial platform.

The platform needs a clear model for:
- who the authenticated identity is
- how that identity maps to a customer account
- how account restrictions are enforced
- how customer lifecycle states affect product actions

## Decision

Supabase will remain the authentication provider for version 1.

The platform database will own the internal customer account model.

Authentication and account state are separate concerns:

### Authentication identity
Supabase user identity proves who is signed in.

### Internal customer account
The platform database owns:
- customer profile
- account lifecycle state
- wallet references
- policy and restriction state
- product eligibility state
- operational review state

Every authenticated customer must map cleanly to one internal account record.

The platform must not treat raw auth identity alone as sufficient business state for product operations.

## Account lifecycle states

Version 1 should support explicit customer lifecycle states.

Minimum state set:
- `registered`
- `email_verified`
- `review_required`
- `active`
- `restricted`
- `frozen`
- `closed`

Actions must be gated by account state.

Examples:
- a registered but not active customer may sign in but not use product flows
- a restricted customer may have partial read-only access
- a frozen customer may be blocked from money movement
- a review-required customer may need operator action before activation

## Admin separation

Admin and customer auth paths must be separated.

The customer authentication model must not be reused as the full internal operator authorization model.

## Why This Decision

This product needs:
- one clean auth-to-account mapping
- policy-safe money movement
- clear customer state transitions
- explicit operator review and restriction capabilities

The current prototype model is not enough.

## Consequences

### Positive

- customer product actions can be gated correctly
- future compliance and risk states have a place in the model
- backend APIs can separate authentication from business authorization
- frontend UX can truthfully reflect account status

### Negative

- the current user model will need redesign or migration
- some existing routes will need to stop assuming that a valid token means the action is allowed
- customer onboarding becomes more explicit

## Non-Goals

This decision does not:
- define the full KYC process yet
- define every possible restriction type yet
- finalize admin identity provider details yet

## Implementation Implications

Later phases must:
- redesign the user and account data model
- add account-state-aware guards and policy checks
- stop mixing authentication state with product eligibility
- create a distinct admin authorization boundary
