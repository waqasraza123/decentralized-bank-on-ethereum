# Release Deployment Artifact Manifests

## Purpose

Use this runbook to bind Phase 12 launch and rollback evidence to immutable API and worker release artifacts.

The launch-closure manifest must carry four deployment artifact records:

- `deploymentArtifacts.apiCurrent`
- `deploymentArtifacts.apiRollback`
- `deploymentArtifacts.workerCurrent`
- `deploymentArtifacts.workerRollback`

Each record must bind the release id to the deployed artifact URI, SHA-256 digest, source commit, runtime, service, accepted environment, and optional provider metadata. The launch-closure pack writes those records to `payloads/release-artifacts.json`, and API/worker rollback evidence payloads reference the same file. The evidence metadata `rollbackReleaseIdentifier` stays aligned to the governed launch rollback id; the API and worker artifact rollback ids are validated inside the payload.

## Required Fields

- `releaseId`: must match the corresponding `artifacts.*ReleaseId` field
- `service`: `api` or `worker`
- `environment`: `staging`, `production_like`, or `production`
- `artifactKind`: `vercel_deployment`, `container_image`, `node_bundle`, `worker_bundle`, or `archive`
- `artifactUri`: provider URI or immutable artifact locator
- `artifactDigestSha256`: SHA-256 digest of the artifact payload or provider export
- `sourceCommitSha`: git commit SHA used to build the artifact
- `runtime`: runtime used by the artifact, such as `nodejs20.x`

Optional fields:

- `deploymentProvider`
- `deploymentId`
- `buildUrl`
- `generatedAt`
- `rollbackValidatedAt`

## Operator Procedure

1. Resolve the currently deployed API and worker artifact metadata from the deployment provider.
2. Resolve the intended rollback API and worker artifact metadata from the prior known-good deployment.
3. Compute or copy the provider-supplied SHA-256 artifact digest.
4. Populate `deploymentArtifacts` in the launch-closure manifest.
5. Run `pnpm release:launch-closure -- validate --manifest <path>`.
6. Scaffold the launch pack and preserve `payloads/release-artifacts.json`.
7. Before rollback drills, compare the active provider artifact URI and digest against the matching current or rollback record.
8. Run rollback probes with `--release-artifacts payloads/release-artifacts.json`.
9. Record rollback evidence only after the deployed rollback artifact matches the manifest record.

## Acceptance Criteria

- launch-closure validation passes
- current and rollback release ids are different for both API and worker
- every artifact digest is a valid SHA-256 checksum
- every source commit is a 7 to 40 character git SHA
- `payloads/release-artifacts.json` is preserved with the launch evidence
- `api_rollback_drill` and `worker_rollback_drill` evidence payloads include the matching current and rollback artifact records
- the release-readiness API accepts rollback evidence only when the payload service, environment, artifact digest, source commit, artifact manifest path, and governed launch rollback id all match the request

## Failure Handling

- Missing digest: regenerate the artifact export or use the deployment provider's immutable checksum before validation.
- Release id mismatch: update either `artifacts.*ReleaseId` or the deployment artifact record so the manifest has one source of truth.
- Rollback artifact equals current artifact: select a prior known-good artifact or explicitly stop the launch approval path until rollback posture is clarified.
- Provider metadata changed after pack generation: regenerate the launch-closure pack and preserve the new artifact manifest checksum.
