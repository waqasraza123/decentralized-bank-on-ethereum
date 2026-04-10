# Critical Alert Re-escalation Evidence

## Objective

Prove an overdue critical alert is re-escalated on the expected cadence and leaves accepted durable evidence.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- qualifying overdue critical alert exists
- expected alert id or dedupe key is known

## Required Inputs

- release identifier
- environment
- API base URL
- expected alert id or dedupe key
- minimum expected re-escalation count
- operator id and role

## Steps Performed

1. identify the overdue critical alert used for proof
2. confirm the alert remains eligible for timed re-escalation
3. wait for or trigger the normal worker-driven re-escalation cadence
4. run `pnpm release:readiness:probe -- --probe critical_alert_reescalation ... --record-evidence`

## Expected Outcome

- probe returns `passed`
- matching alert shows the required re-escalation count
- accepted evidence is recorded for `critical_alert_reescalation`

## Actual Outcome

- Status:
- Summary:
- Details:

## Timestamps

- Started at:
- Observed at:
- Completed at:

## Environment

- Release identifier:
- Environment:
- API base URL:

## Operators

- Requester:
- Reviewer:

## Artifact Links Or References

- 

## Notes Or Exceptions

- 

## Final Status

- pending
