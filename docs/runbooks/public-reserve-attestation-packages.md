# Public Reserve Attestation Packages

This runbook covers downloadable public reserve attestation packages.

Reserve attestation packages are read-only trust artifacts derived from persisted `SolvencyReserveEvidence` rows. They do not rerun blockchain reads, mutate reserve wallets, change policy state, or create new solvency snapshots.

## Endpoints

### Latest Reserve Attestation

```http
GET /solvency/public/reports/latest/reserve-attestation
```

### Snapshot-Specific Reserve Attestation

```http
GET /solvency/public/reports/{snapshotId}/reserve-attestation
```

Snapshot-specific lookups are scoped to the API runtime environment. A production API only serves production snapshots even when a caller knows a staging snapshot id.

## Response Shape

The response is wrapped in the standard API envelope. The `data` object includes:

- `packageVersion`
- `packageType = public_reserve_attestation`
- `generatedAt`
- `artifactName`
- `packageChecksumSha256`
- `verification`
- `report`
- `snapshot`
- `signedAttestation`
- `assetSummaries`
- `reserveEvidence`

## Signed Attestation

`signedAttestation` contains:

- `canonicalPayload`
- `canonicalPayloadText`
- `attestationHash`
- `attestationChecksumSha256`
- `signature`
- `signerAddress`
- `signatureAlgorithm`

The attestation payload binds the reserve evidence to:

- the solvency snapshot id
- the signed solvency report hash
- the signed solvency report checksum
- the runtime environment
- the product chain id
- the snapshot status and evidence freshness
- reserve totals
- per-asset reserve summaries
- per-wallet reserve evidence rows

## Reserve Evidence Contents

Each reserve evidence row includes:

- asset metadata
- reserve source type
- wallet id, address, kind, and custody type when available
- evidence freshness
- observed, usable, encumbered, and excluded balances
- observation timestamp
- staleness window
- read error code and message when evidence could not be read
- source metadata

## Verification Procedure

1. Hash `signedAttestation.canonicalPayloadText` with SHA-256 and compare it with `signedAttestation.attestationChecksumSha256`.
2. Hash `signedAttestation.canonicalPayloadText` with Keccak-256 and compare it with `signedAttestation.attestationHash`.
3. Recover `signerAddress` from `signedAttestation.attestationHash` and `signedAttestation.signature`.
4. Match `signedAttestation.canonicalPayload.reportHash` to the bundled `report.reportHash`.
5. Match `signedAttestation.canonicalPayload.reportChecksumSha256` to the bundled `report.reportChecksumSha256`.
6. Verify the bundled report separately with the public solvency proof bundle procedure.

## Package Checksum

`packageChecksumSha256` is the SHA-256 checksum of the canonical JSON package with `packageChecksumSha256` set to `null`.

This checksum detects accidental artifact mutation after download. It is not a replacement for verifying the attestation signature or the signed solvency report.

## Web Surface

The public trust center exposes reserve attestation downloads from `/trust/solvency`.

## Safety Invariants

- packages are derived from persisted reserve evidence
- public reserve attestations do not include customer liability leaves
- package generation does not perform live blockchain reads
- snapshot-specific routes remain environment-scoped
- attestation payloads bind back to a signed solvency report
- bundle downloads do not change policy, reserve, ledger, or customer state
