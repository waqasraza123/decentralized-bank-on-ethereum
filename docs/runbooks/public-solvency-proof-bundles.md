# Public Solvency Proof Bundles

This runbook covers the downloadable solvency proof bundle surfaces.

The bundle endpoints are read-only trust artifacts. They do not generate new solvency snapshots, mutate policy state, or expose customer liability leaves through public routes.

## Public Bundle

Use the public bundle when an operator, customer, auditor, or external reviewer needs the signed report payload and asset-level liability roots as one portable JSON artifact.

### Latest Public Bundle

```http
GET /solvency/public/reports/latest/bundle
```

### Snapshot-Specific Public Bundle

```http
GET /solvency/public/reports/{snapshotId}/bundle
```

The response is wrapped in the standard API envelope. The `data` object includes:

- `bundleVersion`
- `bundleType = public_solvency_report`
- `generatedAt`
- `artifactName`
- `bundleChecksumSha256`
- `verification`
- `report`
- `snapshot`
- `signedPayload`
- `assetRoots`

The public bundle includes the signed canonical report payload, report hash, SHA-256 checksum, signature, signer address, signature algorithm, and per-asset Merkle roots. It intentionally excludes customer liability leaves.

Snapshot-specific public bundles are scoped to the API runtime environment. A production API only serves production snapshots even when a caller knows a staging snapshot id.

## Customer Bundle

Use the customer bundle when an authenticated customer needs a portable proof that their liability leaf was included in a specific solvency snapshot.

```http
GET /solvency/me/liability-proof/bundle
GET /solvency/me/liability-proof/bundle?snapshotId={snapshotId}
```

The customer route requires the normal customer JWT. The response includes every public bundle field plus:

- `bundleType = customer_liability_proof`
- `customerAccountId`
- `customerProofs`

Each customer proof includes:

- asset metadata
- `leafIndex`
- `leafHash`
- `rootHash`
- Merkle proof path
- canonical liability leaf payload

The liability leaf payload includes available, reserved, vault-locked, pending vault-release, pending-credit, and total liability amounts.

Snapshot-specific customer bundles are also scoped to the API runtime environment and to the authenticated customer account.

## Verification Procedure

1. Hash `signedPayload.canonicalPayloadText` with SHA-256 and compare it with `signedPayload.reportChecksumSha256`.
2. Hash `signedPayload.canonicalPayloadText` with Keccak-256 and compare it with `signedPayload.reportHash`.
3. Recover the signer from `signedPayload.reportHash` and `signedPayload.signature`, then compare it with `signedPayload.signerAddress`.
4. For customer bundles, hash each `customerProofs[].payload` using the liability leaf canonicalization rules, compare it with `leafHash`, then rebuild the Merkle path to `rootHash`.
5. Match `rootHash` to the corresponding entry in `assetRoots[].liabilityMerkleRoot`.

## Bundle Checksum

`bundleChecksumSha256` is the SHA-256 checksum of the canonical JSON bundle with `bundleChecksumSha256` set to `null`.

This checksum detects accidental artifact mutation after download. It is not a replacement for verifying the signed solvency report or the customer Merkle proof.

## Web Surfaces

The web trust center exposes public bundle downloads from `/trust/solvency`.

The authenticated proof page exposes customer bundle downloads from `/proofs/me`.

## Safety Invariants

- public routes never return customer liability leaves
- customer bundles are scoped to the authenticated customer account
- bundles are derived from persisted signed reports and liability leaves
- bundles do not create or rerun solvency snapshots
- bundle downloads do not change policy, reserve, ledger, or customer state
