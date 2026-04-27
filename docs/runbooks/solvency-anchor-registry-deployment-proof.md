# Solvency Anchor Registry Deployment Proof

This runbook defines the release-readiness proof for the on-chain solvency report anchor registry.

Use it after `SolvencyReportAnchorRegistry` has been deployed to staging, production-like, or production and before final governed launch approval is requested.

## Evidence Type

Record this proof as:

- `evidenceType`: `solvency_anchor_registry_deployment`
- accepted environments: `staging`, `production_like`, `production`
- required top-level metadata: `releaseIdentifier`

The release-readiness approval gate treats this as a required external proof. Development and CI evidence do not satisfy the gate because the proof must bind a real deployment address, owner, authorized anchor signer, ABI checksum, and deployment manifest commit.

## Required Payload

`evidencePayload` must include these fields:

```json
{
  "proofKind": "manual_attestation",
  "networkName": "sepolia",
  "chainId": 11155111,
  "contractProductSurface": "solvency_report_anchor_registry_v1",
  "signerScope": "solvency_anchor_execution",
  "contractAddress": "0x0000000000000000000000000000000000000000",
  "deploymentTxHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "governanceOwner": "0x0000000000000000000000000000000000000000",
  "authorizedAnchorer": "0x0000000000000000000000000000000000000000",
  "abiChecksumSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "manifestPath": "packages/contracts/deployments/staging.manifest.json",
  "manifestCommitSha": "0000000"
}
```

Optional but recommended fields:

- `blockExplorerUrl`
- `anchoredSmokeTxHash`
- `anchorerKeyReference`
- `anchorerSignerAddress`

## Acceptance Criteria

- the manifest contains `solvency_report_anchor_registry_v1`
- the manifest ABI checksum matches the deployed registry ABI artifact used by operators
- the registry address is the deployed address for the accepted chain id
- the deployment transaction hash is durable and reviewable
- `owner()` resolves to the recorded governance owner
- `authorizedAnchorer()` resolves to the recorded authorized anchorer
- the governed signer inventory contains `solvency_anchor_execution`
- the `solvency_anchor_execution` signer address matches the authorized anchorer
- any post-deploy smoke anchor transaction is linked when it exists

## Recording Through The CLI

Use the release-readiness verifier for a manual attestation:

```bash
pnpm release:readiness:verify -- \
  --proof solvency_anchor_registry_deployment \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --summary "Solvency anchor registry deployment verified for launch-2026.04.10.1." \
  --evidence-links https://sepolia.etherscan.io/tx/<deployment-tx>,packages/contracts/deployments/staging.manifest.json \
  --evidence-payload-json '{"proofKind":"manual_attestation","networkName":"sepolia","chainId":11155111,"contractProductSurface":"solvency_report_anchor_registry_v1","signerScope":"solvency_anchor_execution","contractAddress":"0x0000000000000000000000000000000000000000","deploymentTxHash":"0x0000000000000000000000000000000000000000000000000000000000000000","governanceOwner":"0x0000000000000000000000000000000000000000","authorizedAnchorer":"0x0000000000000000000000000000000000000000","abiChecksumSha256":"0000000000000000000000000000000000000000000000000000000000000000","manifestPath":"packages/contracts/deployments/staging.manifest.json","manifestCommitSha":"0000000"}' \
  --record-evidence \
  --base-url https://prodlike-api.example.com \
  --access-token "$INTERNAL_OPERATOR_API_KEY"
```

The API rejects this evidence when any required payload field is missing or malformed. It also rejects launch approval while this evidence is missing, failed, stale, or scoped to another release identifier.

## Launch-Closure Pack

When using the launch-closure manifest, populate:

- `chain.networkName`
- `chain.chainId`
- `contracts[]` entry with `productSurface: "solvency_report_anchor_registry_v1"`
- `governedCustody.signerInventory[]` entry with `scope: "solvency_anchor_execution"`
- `solvencyAnchorRegistryDeployment.deploymentTxHash`
- `solvencyAnchorRegistryDeployment.governanceOwner`
- `solvencyAnchorRegistryDeployment.authorizedAnchorer`
- `solvencyAnchorRegistryDeployment.manifestPath`
- `solvencyAnchorRegistryDeployment.manifestCommitSha`

The pack generator writes `payloads/solvency_anchor_registry_deployment.json` from those values so the operator can record the proof through the same release-readiness evidence endpoint as the other launch proofs.
