# Notification Cutover Verification Evidence

## Objective

Prove the unified notification system is live for the accepted launch environment across customer and operator inboxes, unread summaries, preference matrices, and websocket resume sessions.

## Preconditions

- accepted environment is staging, production_like, or production
- requester has a fresh operator bearer token
- launch smoke customer has a fresh customer JWT
- notification tables and websocket session issuance are enabled in the target API

## Required Inputs

- release identifier
- environment
- API base URL
- requester id and role
- operator access token environment variable
- customer access token environment variable
- launch smoke customer reference

## Steps Performed

1. sign in as the launch smoke customer and export a customer JWT
2. export a requester operator bearer token
3. run `pnpm release:readiness:probe -- --probe notification_cutover_verification`
4. record passed release-readiness evidence

## Expected Outcome

- customer notification feed, unread count, preferences, and socket-session endpoints return coherent state
- operator notification feed, unread count, preferences, and socket-session endpoints return coherent state
- websocket resume sessions issue non-empty tokens with latest sequence state
- release-readiness evidence is recorded with evidenceType `notification_cutover_verification`

## Actual Outcome

- Status:
- Summary:
- Details:

## Timestamps

- Started at:
- Completed at:
- Observed at:

## Environment

- Release identifier:
- Environment:
- API base URL:
- Customer verification account:

## Artifact Links Or References

-

## Notes Or Exceptions

-

## Final Status

- pending
