# Worker Rollback Drill Evidence

## Objective

Prove the prior worker artifact resumes heartbeat and safe queue processing without duplicate execution.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- current and rollback worker release ids are confirmed
- expected worker identifier is known
- `payloads/release-artifacts.json` binds the current and rollback worker artifacts

## Required Inputs

- release identifier
- governed launch rollback release identifier
- environment
- API base URL
- current worker release id
- rollback worker release id
- current worker artifact digest
- rollback worker artifact digest
- expected worker identifier
- operator id and role

## Steps Performed

1. stop the current worker runtime
2. compare the current and rollback provider artifacts against `payloads/release-artifacts.json`
3. deploy the rollback worker artifact
4. confirm heartbeat resumes for the expected worker identifier
5. run `pnpm release:readiness:probe -- --probe worker_rollback_drill ... --release-artifacts payloads/release-artifacts.json --record-evidence`

## Expected Outcome

- probe returns `passed`
- evidence payload includes current and rollback worker artifact records and the governed launch rollback identifier
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
