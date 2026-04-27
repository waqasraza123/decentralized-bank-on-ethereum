# API Rollback Drill Evidence

## Objective

Prove the prior known-good API artifact can be restored against the current schema without hidden runtime migration assumptions.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- current and rollback API release ids are confirmed
- `payloads/release-artifacts.json` binds the current and rollback API artifacts

## Required Inputs

- release identifier
- environment
- API base URL
- current API release id
- rollback API release id
- current API artifact digest
- rollback API artifact digest
- operator id and role

## Steps Performed

1. capture the current release identifier
2. compare the current and rollback provider artifacts against `payloads/release-artifacts.json`
3. deploy the rollback API artifact
4. confirm the API is serving against the current schema
5. run `pnpm release:readiness:probe -- --probe api_rollback_drill ... --record-evidence`

## Expected Outcome

- probe returns `passed`
- evidence payload includes current and rollback API artifact records
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
