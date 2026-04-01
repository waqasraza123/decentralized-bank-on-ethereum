# Wallet Projection Safe Batch Runbook

## Purpose

This runbook executes the safe wallet migration workflow in the correct operator order.

The batch runner chains these steps:

1. missing customer projection repair
2. missing customer account and wallet repair
3. wallet-only repair
4. post-repair audit summary
5. optional manual-review export

The runner stops on the first failing step.

Dry-run mode is the default.

## Script

From `apps/api`:

```bash
pnpm run repair:wallet-projection-safe-batch
```

## Supported options

### Dry-run all rows

```bash
pnpm run repair:wallet-projection-safe-batch
```

### Dry-run limited batch

```bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100
```

### Apply limited batch

```bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --apply
```

### Dry-run one user

```bash
pnpm run repair:wallet-projection-safe-batch -- --email=user@example.com
```

### Apply one user

```bash
pnpm run repair:wallet-projection-safe-batch -- --email=user@example.com --apply
```

### Run batch and export manual-review queue

```bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --export-manual-review
```

### Run batch and choose manual-review export path

```bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --export-manual-review --manual-review-output=.artifacts/wallet-manual-review-batch.json
```

## Output shape

The script prints one JSON object with:

* `mode`
* `productChainId`
* `filters`
* `steps`
* `manualReviewExport`

Each step includes:

* `command`
* `summary`

## Safety notes

* dry-run is the default
* `--apply` must be explicit
* the runner only chains the already bounded safe repair commands
* manual-review-only rows are not auto-repaired by this command
* the batch stops immediately if any sub-step fails

## Recommended rollout

1. Run the batch in dry-run mode
2. Review the combined summaries
3. Apply a small limited batch
4. Re-run with manual-review export enabled
5. Hand remaining hard cases to operators

## Success condition

A successful batch should show:

* repairable rows shrinking across the three safe repair stages
* post-repair audit moving more rows into `wallet_projected`
* manual-review export containing only the true hard cases
