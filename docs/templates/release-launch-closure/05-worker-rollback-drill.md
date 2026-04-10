# Worker Rollback Drill Evidence

## Objective

Prove the prior worker artifact resumes heartbeat and safe queue processing without duplicate execution.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- current and rollback worker release ids are confirmed
- expected worker identifier is known

## Required Inputs

- release identifier
- environment
- API base URL
- current worker release id
- rollback worker release id
- expected worker identifier
- operator id and role

## Steps Performed

1. stop the current worker runtime
2. deploy the rollback worker artifact
3. confirm heartbeat resumes for the expected worker identifier
4. run `pnpm release:readiness:probe -- --probe worker_rollback_drill ... --record-evidence`

## Expected Outcome

- probe returns `passed`
- worker heartbeat and health recover within the expected window
- accepted evidence is recorded for `worker_rollback_drill`

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
