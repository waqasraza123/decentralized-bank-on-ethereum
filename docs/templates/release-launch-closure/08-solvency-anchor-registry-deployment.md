# Solvency Anchor Registry Deployment Evidence

## Objective

Record accepted proof that the solvency report anchor registry is deployed, governed, authorized for the launch anchor signer, and bound to the deployment manifest.

## Preconditions

- deployment manifest contains `solvency_report_anchor_registry_v1`
- governed signer inventory contains `solvency_anchor_execution`
- registry owner and authorized anchorer have been read from the accepted chain
- ABI checksum and deployment transaction are captured from the staged or launch deployment

## Required Inputs

- release identifier
- environment
- chain id and network name
- registry contract address
- deployment transaction hash
- registry governance owner
- authorized anchorer address
- ABI SHA-256 checksum
- deployment manifest path and commit SHA
- block explorer link or durable deployment artifact link
- on-chain verification observation for production-like or production launches

## Steps Performed

1. confirm the registry address and ABI checksum match the checked-in deployment manifest
2. read the registry owner and authorized anchorer from the accepted chain
3. confirm the authorized anchorer matches the governed `solvency_anchor_execution` signer inventory
4. confirm deployed bytecode, deployment receipt, deployment block, and RPC host are captured in `onchainVerification`
5. record `solvency_anchor_registry_deployment` evidence with the structured payload

## Expected Outcome

- accepted evidence is recorded for `solvency_anchor_registry_deployment`
- evidence payload binds chain id, registry address, deployment transaction, owner, authorized anchorer, ABI checksum, manifest commit, and on-chain verification metadata
- governed launch approval remains blocked if this proof is missing, failed, stale, or recorded for another release

## Actual Outcome

- Status:
- Summary:
- Details:

## Timestamps

- Observed at:
- Recorded at:

## Environment

- Release identifier:
- Environment:
- Chain id:
- Network:

## Chain Evidence

- Registry address:
- Deployment transaction:
- Governance owner:
- Authorized anchorer:
- ABI checksum:
- Manifest path:
- Manifest commit SHA:
- RPC host:
- Deployment block:
- Deployment transaction index:
- Deployed bytecode present:

## Artifact Links Or References

-

## Notes Or Exceptions

-

## Final Status

- pending
