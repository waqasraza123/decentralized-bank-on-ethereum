# Solvency Report Hash Anchoring

## Purpose

Solvency report hash anchoring records the lifecycle of publishing a signed solvency report hash to an external chain. The API remains the system of record for report construction, signature verification, audit events, and public trust-center display; the chain transaction is a public timestamp and tamper-evidence layer for the already signed report hash.

## Data Model

`SolvencyReportAnchor` is bound to one `SolvencyReport` and stores:

- the target `environment` and `chainId`
- deterministic `anchorPayload`, `anchorPayloadText`, `anchorPayloadHash`, and `anchorPayloadChecksumSha256`
- optional `contractAddress`
- lifecycle status: `requested`, `submitted`, `confirmed`, or `failed`
- transaction evidence: `txHash`, `blockNumber`, and `logIndex`
- operator identity and role fields for manual request, submission, confirmation, and failure
- worker identity fields for automated submission, confirmation, and failure

The unique key is `(reportId, anchorPayloadHash)`. Re-requesting the same report, chain, and contract payload returns the existing anchor instead of creating duplicate records.

## Anchor Payload

Anchor requests canonicalize this payload with `stableStringify`:

```json
{
  "version": 1,
  "anchorType": "solvency_report_hash",
  "environment": "production",
  "chainId": 1,
  "reportId": "report_id",
  "snapshotId": "snapshot_id",
  "reportVersion": 1,
  "reportHash": "0x...",
  "reportChecksumSha256": "hex_sha256",
  "signerAddress": "0x...",
  "signatureAlgorithm": "ethereum-secp256k1-keccak256-v1",
  "contractAddress": "0x... or null",
  "publishedAt": "ISO-8601 timestamp"
}
```

`anchorPayloadHash` is `keccak256(anchorPayloadText)`. `anchorPayloadChecksumSha256` is `sha256(anchorPayloadText)`.

## Internal API Lifecycle

All routes require the internal operator bearer guard.

### Request Anchor

`POST /solvency/internal/reports/:reportId/anchor-requests`

Body:

```json
{
  "chainId": 1,
  "contractAddress": "0x0000000000000000000000000000000000000000",
  "anchorNote": "Mainnet report hash anchor"
}
```

`chainId` defaults to the report chain. `contractAddress` and `anchorNote` are optional. The response includes `{ anchor, stateReused }`.

### Record Submitted Transaction

`POST /solvency/internal/report-anchors/:anchorId/record-submitted`

Body:

```json
{
  "txHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "contractAddress": "0x0000000000000000000000000000000000000000",
  "blockNumber": 123,
  "logIndex": 0
}
```

Use this when the anchoring transaction has been broadcast or mined but final confirmation is still pending.

### Record Confirmed Transaction

`POST /solvency/internal/report-anchors/:anchorId/record-confirmed`

Body shape matches `record-submitted`. Confirmation must use the same transaction hash if a submitted hash already exists.

### Record Failure

`POST /solvency/internal/report-anchors/:anchorId/record-failed`

Body:

```json
{
  "failureReason": "Transaction reverted before inclusion."
}
```

Confirmed anchors cannot be marked failed. Failed anchors may later be resubmitted through `record-submitted`.

## Public Surface

Public solvency report responses include `report.anchors`, ordered newest first. The trust center shows the latest anchor status, chain id, anchor payload hash, transaction hash, block number, and confirmation timestamp when available.

The public surface does not create or mutate anchor records.

## Worker Handoff

The internal worker API exposes anchor queues for contract or multisig automation:

- `GET /solvency/internal/worker/report-anchors/requested`
- `GET /solvency/internal/worker/report-anchors/submitted`
- `POST /solvency/internal/worker/report-anchors/:anchorId/record-submitted`
- `POST /solvency/internal/worker/report-anchors/:anchorId/record-confirmed`
- `POST /solvency/internal/worker/report-anchors/:anchorId/record-failed`

The worker runtime now polls those queues every iteration:

- `requested` anchors are logged as broadcast-ready handoff items when no broadcaster is configured.
- `requested` anchors are broadcast in managed mode when `WORKER_SOLVENCY_ANCHOR_CONTRACT_ADDRESS` and `WORKER_SOLVENCY_ANCHOR_SIGNER_PRIVATE_KEY` are both configured.
- `synthetic` mode records a deterministic synthetic transaction hash so local/dev flows can exercise the lifecycle without a chain write.
- `submitted` anchors are monitored through the configured RPC client.
- reverted transactions are marked `failed`.
- successful transactions are marked `confirmed` after `WORKER_CONFIRMATION_BLOCKS`.

The repo-owned contract is `SolvencyReportAnchorRegistry` in `packages/contracts`. It stores one immutable record per `anchorPayloadHash` and emits `SolvencyReportAnchored(anchorPayloadHash, reportIdHash, snapshotIdHash, reportChainId, anchorer, anchoredAt)`.

The registry is owned by the governance safe and has a separate `authorizedAnchorer` address for the managed worker signer. Governance can rotate that signer with `setAuthorizedAnchorer`.

The worker broadcaster calls:

```solidity
anchorSolvencyReport(
  bytes32 anchorPayloadHash,
  bytes32 reportIdHash,
  bytes32 snapshotIdHash,
  uint256 reportChainId
)
```

`reportIdHash` and `snapshotIdHash` are Keccak-256 hashes of the report and snapshot identifiers embedded in `anchorPayload`.

Externally submitted multisig transactions remain supported: operators can request the anchor, submit the transaction through a safe, then call `record-submitted`. The worker confirmation path will still monitor and confirm that transaction.

## Contract Deployment

The contracts workspace includes:

- `packages/contracts/contracts/SolvencyReportAnchorRegistry.sol`
- `packages/contracts/ignition/modules/SolvencyReportAnchorRegistry.ts`
- SDK ABI helper `createSolvencyReportAnchorRegistryContract`
- deployment manifest entries for `solvency_report_anchor_registry_v1`

Deploy command:

```bash
pnpm --filter @stealth-trails-bank/contracts deploy:solvency-anchor-registry
```

After deployment:

1. update the appropriate `packages/contracts/deployments/*.manifest.json` address and ABI checksum
2. configure `WORKER_SOLVENCY_ANCHOR_CONTRACT_ADDRESS`
3. configure `WORKER_SOLVENCY_ANCHOR_SIGNER_PRIVATE_KEY` only for the managed worker signer approved as the registry `authorizedAnchorer`
4. keep `WORKER_EXECUTION_MODE=managed` for automatic broadcasting, or omit the signer pair for manual multisig submission plus worker confirmation monitoring

## Operator Verification

1. Download the public solvency proof bundle for the same snapshot.
2. Confirm the bundle `report.reportHash` equals the anchor payload `reportHash`.
3. Recompute `sha256(anchorPayloadText)` and match `anchorPayloadChecksumSha256`.
4. Recompute `keccak256(anchorPayloadText)` and match `anchorPayloadHash`.
5. Inspect `SolvencyReportAnchored` and confirm it committed the same `anchorPayloadHash`.
6. Confirm the public trust center shows `confirmed`, the expected `txHash`, and the expected block metadata.

## Safety Invariants

- Anchor records never replace the signed solvency report or report signature.
- Anchor mutations are internal-operator-only and audit logged.
- Worker anchor mutations require the internal worker API key and write worker actor identity.
- The public API exposes anchor evidence but never grants anchoring write access.
- Idempotent requests prevent duplicate anchor rows for the same canonical payload.
- Confirmation cannot switch transaction hashes after submission.
- Confirmed anchors cannot be failed or resubmitted.
