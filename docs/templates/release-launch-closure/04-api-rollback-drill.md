# API Rollback Drill Evidence

## Objective

Prove the prior known-good API artifact can be restored against the current schema without hidden runtime migration assumptions.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- current and rollback API release ids are confirmed

## Required Inputs

- release identifier
- environment
- API base URL
- current API release id
- rollback API release id
- operator id and role

## Steps Performed

1. capture the current release identifier
2. deploy the rollback API artifact
3. confirm the API is serving against the current schema
4. run `pnpm release:readiness:probe -- --probe api_rollback_drill ... --record-evidence`

## Expected Outcome

- probe returns `passed`
- required operator reads remain available after rollback
- accepted evidence is recorded for `api_rollback_drill`

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
