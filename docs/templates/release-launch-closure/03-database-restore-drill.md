# Database Restore Drill Evidence

## Objective

Prove a recent production-like backup restores cleanly and the restored API surface remains readable without schema drift.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- clean restore environment exists
- backup reference is confirmed

## Required Inputs

- release identifier
- environment
- restore validation API base URL
- backup or snapshot reference
- operator id and role

## Steps Performed

1. provision the restore target
2. restore the selected backup or snapshot
3. boot the API against the restored environment
4. run `pnpm release:readiness:probe -- --probe database_restore_drill ... --record-evidence`

## Expected Outcome

- probe returns `passed`
- required operator reads succeed after restore
- accepted evidence is recorded for `database_restore_drill`

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
- Restore API base URL:

## Operators

- Requester:
- Reviewer:

## Artifact Links Or References

- 

## Notes Or Exceptions

- 

## Final Status

- pending
