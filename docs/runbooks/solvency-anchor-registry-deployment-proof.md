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

## Generate Evidence From The Deployment Manifest

Prefer generating the evidence payload from the governed custody deployment manifest instead of hand-copying JSON:

```bash
pnpm release:solvency-anchor-proof -- \
  --manifest packages/contracts/deployments/base-sepolia.manifest.json \
  --release-id launch-2026.04.10.1 \
  --manifest-commit <git-sha> \
  --network-name base-sepolia \
  --evidence-links https://sepolia.etherscan.io/tx/<deployment-tx>,packages/contracts/deployments/base-sepolia.manifest.json \
  --output artifacts/release-launch/solvency-anchor-registry-evidence.json
```

To generate and record in one operator-controlled step:

```bash
pnpm release:solvency-anchor-proof -- \
  --manifest packages/contracts/deployments/base-sepolia.manifest.json \
  --release-id launch-2026.04.10.1 \
  --manifest-commit <git-sha> \
  --network-name base-sepolia \
  --verify-onchain \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --evidence-links https://sepolia.etherscan.io/tx/<deployment-tx>,packages/contracts/deployments/base-sepolia.manifest.json \
  --record-evidence \
  --base-url https://prodlike-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

For API-side manifest preflight without recording:

```bash
pnpm release:solvency-anchor-proof -- \
  --manifest packages/contracts/deployments/base-sepolia.manifest.json \
  --release-id launch-2026.04.10.1 \
  --manifest-commit <git-sha> \
  --network-name base-sepolia \
  --preflight-only \
  --base-url https://prodlike-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

When `--record-evidence` is used for a passed proof, the generator runs the same API preflight automatically before it posts evidence. It refuses to record when the preflight is not `recordable`, when the API reports blockers, or when the API draft differs from the generated proof. `--skip-preflight` exists only for break-glass recording after the governance approver explicitly accepts the risk in the evidence note.

Use `--verify-onchain --rpc-url <url>` before recording production-like or production proof. The generator then verifies:

- the RPC chain id matches `manifest.chainId`
- the registry address has deployed bytecode
- the deployment transaction receipt exists and succeeded
- `owner()` matches the manifest `governanceOwner`
- `authorizedAnchorer()` matches the manifest `authorizedAnchorer`

The generated evidence payload includes an `onchainVerification` object with the observed chain id, RPC host, deployment block, registry owner, and authorized anchorer. The RPC URL itself is not persisted.

The API requires `onchainVerification` for passed `production_like` and `production` evidence before it writes the record. It must match the top-level payload chain id, registry address, deployment transaction hash, governance owner, and authorized anchorer; `bytecodePresent` must be `true`; `deploymentBlockNumber` must be positive when supplied; and `rpcUrlHost` must be present. Malformed `onchainVerification` data is rejected instead of ignored.

The generator reads:

- `authorities[]` entry with `authorityType: "governance_safe"`
- `signers[]` entry with `scope: "solvency_anchor_execution"`
- `contracts[]` entry with `productSurface: "solvency_report_anchor_registry_v1"`

The contract manifest entry must include:

- `deploymentTxHash`
- `governanceOwner`
- `authorizedAnchorer`
- `abiChecksumSha256`
- optional `blockExplorerUrl`
- optional `anchoredSmokeTxHash`

The command refuses to produce or record accepted proof when the registry owner does not match the governance safe, the authorized anchorer does not match the governed anchor signer, the ABI checksum is still a placeholder, or the deployment transaction hash is missing.

## Manifest Preflight

Before recording accepted evidence, check the API-side governed manifest bindings that the write path will enforce:

```bash
curl -sS \
  -H "Authorization: Bearer $INTERNAL_OPERATOR_API_KEY" \
  "https://prodlike-api.example.com/release-readiness/internal/solvency-anchor-registry-deployment-proof?environment=production_like&chainId=84532&networkName=base-sepolia&manifestPath=packages/contracts/deployments/base-sepolia.manifest.json&manifestCommitSha=<git-sha>&releaseIdentifier=launch-2026.04.10.1"
```

Treat the preflight as a deployment proof gate:

- `ready: true` means the active `ContractDeploymentManifest` is non-legacy and contains deployment proof fields for the requested environment and chain
- `blockers` lists the exact missing or mismatched records, including absent deployment transaction hash, absent owner or anchorer, signer mismatch, and governance safe mismatch
- `requiredOperatorInputs` lists evidence fields that are intentionally not persisted in the manifest tables, such as `networkName`, `manifestPath`, `manifestCommitSha`, and `releaseIdentifier`
- `evidenceRequestDraft.body` mirrors the `POST /release-readiness/internal/evidence` request body; post it only when `evidenceRequestDraft.recordable` is `true`

The admin Launch Readiness console exposes the same preflight from the evidence workspace. Select `solvency_anchor_registry_deployment`, keep the launch-closure manifest draft aligned with the target release, and use `Preflight proof`. The console reads chain id, network name, manifest path, manifest commit SHA, and release identifier from the manifest draft plus evidence form, then fills the evidence payload JSON from `evidenceRequestDraft.body`. It displays the active registry address, deployment transaction, anchor signer, governance safe, and signer key-reference fingerprint returned by the API. The console disables recording for this evidence type until the latest preflight response is recordable. For `production_like` and `production`, paste only the generated `onchainVerification` object into the preflighted payload before recording; changing the preflighted registry, chain, owner, signer, manifest, or release fields blocks recording.

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

The API rejects this evidence when any required payload field is missing or malformed. Before persisting the record, it also cross-checks the payload against active governed manifest tables:

- `ContractDeploymentManifest` must contain the same chain id, registry address, deployment transaction hash, governance owner, authorized anchorer, and ABI checksum
- `GovernedSignerInventory` must contain an active `solvency_anchor_execution` signer at the authorized anchorer address
- `GovernanceAuthorityManifest` must contain an active `governance_safe` authority at the governance owner address

It also rejects launch approval while this evidence is missing, failed, stale, or scoped to another release identifier.

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
- `solvencyAnchorRegistryDeployment.onchainVerification.chainId`
- `solvencyAnchorRegistryDeployment.onchainVerification.rpcUrlHost`
- `solvencyAnchorRegistryDeployment.onchainVerification.contractAddress`
- `solvencyAnchorRegistryDeployment.onchainVerification.deploymentTxHash`
- `solvencyAnchorRegistryDeployment.onchainVerification.deploymentBlockNumber`
- `solvencyAnchorRegistryDeployment.onchainVerification.owner`
- `solvencyAnchorRegistryDeployment.onchainVerification.authorizedAnchorer`
- `solvencyAnchorRegistryDeployment.onchainVerification.bytecodePresent`

For `production_like` and `production`, the pack generator rejects the manifest unless `solvencyAnchorRegistryDeployment.onchainVerification` is present, uses the same chain id, registry address, deployment transaction, owner, and authorized anchorer as the rest of the manifest, reports deployed bytecode, includes an RPC host, and carries a positive deployment block. The generator writes `payloads/solvency_anchor_registry_deployment.json` from those values so the operator can record the proof through the same release-readiness evidence endpoint as the other launch proofs without weakening the API write gate.
