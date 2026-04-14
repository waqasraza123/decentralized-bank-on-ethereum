# Final Governed Launch Approval Evidence

## Objective

Request and complete the dual-control launch approval only after all required evidence and checklist attestations are complete.

## Preconditions

- accepted evidence exists for every required proof
- manifest is validated
- requester and approver are different identities
- approval request body is populated truthfully

## Required Inputs

- release identifier
- environment
- API base URL
- rollback release identifier
- requester id and role
- approver id and role
- approval request payload

## Steps Performed

1. review the latest release-readiness summary
2. confirm every checklist section is complete
3. submit the approval request
4. have the separate approver approve or reject the request

## Expected Outcome

- approval request is created with a truthful evidence snapshot
- approval remains blocked if any proof is missing, failed, stale, or bound to the wrong rollback release
- launch is approved only through the dual-control approval path

## Actual Outcome

- Status:
- Summary:
- Details:

## Timestamps

- Requested at:
- Reviewed at:
- Approved or rejected at:

## Environment

- Release identifier:
- Environment:
- API base URL:

## Operators

- Requester:
- Approver:

## Artifact Links Or References

- 

## Notes Or Exceptions

- 

## Final Status

- pending
