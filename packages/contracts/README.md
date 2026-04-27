# Stealth Trails Contracts

This workspace contains the repo-owned Ethereum contracts and deployment manifests for the bank runtime.

## Solvency Report Anchoring

`contracts/SolvencyReportAnchorRegistry.sol` records immutable public anchors for signed solvency report payload hashes.

The registry stores one record per `anchorPayloadHash` and emits `SolvencyReportAnchored` with:

- `anchorPayloadHash`
- `reportIdHash`
- `snapshotIdHash`
- `reportChainId`
- `anchorer`
- `anchoredAt`

The governance safe owns the registry. A separate `authorizedAnchorer` signer can submit anchors and can be rotated by governance.

Deploy the registry with:

```bash
pnpm --filter @stealth-trails-bank/contracts deploy:solvency-anchor-registry
```

After deployment, update the relevant `deployments/*.manifest.json` entry for `solvency_report_anchor_registry_v1`, then configure the worker with `WORKER_SOLVENCY_ANCHOR_CONTRACT_ADDRESS` and `WORKER_SOLVENCY_ANCHOR_SIGNER_PRIVATE_KEY` if automatic managed broadcasting is approved.

Before release approval, build the release-readiness evidence payload from the same manifest:

```bash
pnpm release:solvency-anchor-proof -- \
  --manifest packages/contracts/deployments/base-sepolia.manifest.json \
  --release-id launch-2026.04.10.1 \
  --manifest-commit <git-sha> \
  --network-name base-sepolia \
  --output artifacts/release-launch/solvency-anchor-registry-evidence.json
```

To record the generated proof immediately, replace `--output ...` with:

```bash
--record-evidence \
--base-url https://prodlike-api.example.com \
--access-token "$OPERATOR_ACCESS_TOKEN"
```

Passed `--record-evidence` first checks `GET /release-readiness/internal/solvency-anchor-registry-deployment-proof` and refuses to post if the API-side deployment manifest, governance safe, or anchor signer inventory is not recordable. Use `--preflight-only --base-url ... --access-token ...` to inspect that gate without writing evidence. `--skip-preflight` is reserved for documented break-glass recording.

The generator refuses placeholder deployment proof. The registry contract entry must include a real `deploymentTxHash`, `governanceOwner`, `authorizedAnchorer`, and SHA-256 ABI checksum, and the authorized anchorer must match the manifest `solvency_anchor_execution` signer.

## Deployment Manifest Proof Fields

After deployment:

1. update the appropriate `packages/contracts/deployments/*.manifest.json` address, ABI checksum, deployment transaction, governance owner, and authorized anchorer
2. run `pnpm --filter @stealth-trails-bank/contracts validate:manifests`
3. generate the release-readiness evidence payload with `pnpm release:solvency-anchor-proof -- --manifest <path> --release-id <id> --manifest-commit <sha>`
4. configure `WORKER_SOLVENCY_ANCHOR_CONTRACT_ADDRESS`
5. configure `WORKER_SOLVENCY_ANCHOR_SIGNER_PRIVATE_KEY` only for the managed worker signer approved as the registry `authorizedAnchorer`
6. keep `WORKER_EXECUTION_MODE=managed` for automatic broadcasting, or omit the signer pair for manual multisig submission plus worker confirmation monitoring
