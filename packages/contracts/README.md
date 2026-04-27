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
