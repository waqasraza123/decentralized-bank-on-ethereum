# Role Review Evidence

## Objective

Record the approved launch operator roster, mapped roles, and any scoped governance exceptions for the accepted environment.

## Preconditions

- accepted environment is `staging`, `production_like`, or `production`
- manifest is validated
- approved operator roster is available

## Required Inputs

- release identifier
- environment
- API base URL
- role review reference
- roster reference
- operator id and role
- evidence links to the reviewed roster and approvals

## Steps Performed

1. review the launch operator roster and mapped roles
2. confirm scoped exceptions or elevated access are documented
3. run `pnpm release:readiness:verify -- --proof role_review ... --record-evidence`

## Expected Outcome

- manual review is recorded as accepted evidence
- evidence links point to the reviewed roster and approval references
- requester and approver separation remains intact

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
