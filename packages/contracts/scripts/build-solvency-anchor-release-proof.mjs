import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const evidenceType = "solvency_anchor_registry_deployment";
const contractProductSurface = "solvency_report_anchor_registry_v1";
const signerScope = "solvency_anchor_execution";
const runbookPath = "docs/runbooks/solvency-anchor-registry-deployment-proof.md";
const acceptedEnvironments = new Set([
  "staging",
  "production_like",
  "production"
]);
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const evmTransactionHashPattern = /^0x[a-fA-F0-9]{64}$/;
const sha256ChecksumPattern = /^(sha256:)?[a-fA-F0-9]{64}$/;
const gitCommitShaPattern = /^[a-fA-F0-9]{7,40}$/;

function printUsage() {
  console.log(`Usage:
  node ./scripts/build-solvency-anchor-release-proof.mjs --manifest <path> --release-id <id> --manifest-commit <sha> [options]

Required:
  --manifest               Governed custody deployment manifest path
  --release-id             Launch release identifier for release-readiness evidence
  --manifest-commit        Git commit SHA that contains the deployment manifest

Optional:
  --network-name           Network label stored in evidencePayload (defaults to manifest.environment)
  --status                 passed | failed (defaults to passed)
  --summary                Override evidence summary
  --note                   Override evidence note
  --evidence-links         Comma-separated durable evidence links
  --output                 Write JSON evidence payload to this file
  --preflight              Check API governed manifest bindings before printing output
  --preflight-only         Check API governed manifest bindings and exit without recording
  --record-evidence        POST the generated payload to release-readiness evidence
  --skip-preflight         Record without API manifest preflight (break-glass only)
  --base-url               Operator API base URL when recording evidence
  --access-token           Operator bearer token when recording evidence
  --help                   Print this message

The manifest contract entry for ${contractProductSurface} must include:
  deploymentTxHash
  governanceOwner
  authorizedAnchorer
  abiChecksumSha256
`);
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextToken;
    index += 1;
  }

  return parsed;
}

function readRequiredStringArg(parsedArgs, key) {
  const value = parsedArgs[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`Missing required argument --${key}.`);
  }

  return value.trim();
}

function readOptionalStringArg(parsedArgs, key) {
  const value = parsedArgs[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readOptionalBooleanFlag(parsedArgs, key) {
  return parsedArgs[key] === true;
}

function parseEvidenceLinks(value) {
  if (!value) {
    return [];
  }

  return [
    ...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))
  ];
}

function resolveRepoRoot() {
  const cwd = process.cwd();

  return (
    path.basename(cwd) === "contracts" &&
      path.basename(path.dirname(cwd)) === "packages"
      ? path.resolve(cwd, "../..")
      : cwd
  );
}

function readManifest(manifestPath) {
  const repoRoot = resolveRepoRoot();
  const cwdPath = path.resolve(process.cwd(), manifestPath);
  const repoPath = path.resolve(repoRoot, manifestPath);
  const absolutePath = existsSync(cwdPath) ? cwdPath : repoPath;

  if (!existsSync(absolutePath)) {
    fail(`Manifest file was not found: ${manifestPath}.`);
  }

  const manifest = JSON.parse(readFileSync(absolutePath, "utf8"));

  return {
    absolutePath,
    relativePath: path.relative(repoRoot, absolutePath),
    manifest
  };
}

function findGovernanceOwner(manifest) {
  return manifest.authorities?.find(
    (authority) => authority.authorityType === "governance_safe"
  );
}

function findAnchorSigner(manifest) {
  return manifest.signers?.find((signer) => signer.scope === signerScope);
}

function findAnchorRegistry(manifest) {
  return manifest.contracts?.find(
    (contract) => contract.productSurface === contractProductSurface
  );
}

function pushIfMissing(errors, value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} is required.`);
  }
}

function pushIfPatternMismatch(errors, value, label, pattern) {
  if (typeof value !== "string" || !pattern.test(value.trim())) {
    errors.push(`${label} is missing or malformed.`);
  }
}

function validateManifestForProof({
  manifest,
  anchorRegistry,
  anchorSigner,
  governanceOwner,
  manifestCommit
}) {
  const errors = [];

  if (!acceptedEnvironments.has(manifest.environment)) {
    errors.push(
      `manifest.environment must be one of ${[...acceptedEnvironments].join(", ")}.`
    );
  }

  if (!Number.isInteger(manifest.chainId) || manifest.chainId <= 0) {
    errors.push("manifest.chainId must be a positive integer.");
  }

  if (!governanceOwner) {
    errors.push("manifest.authorities must include governance_safe.");
  } else {
    pushIfPatternMismatch(
      errors,
      governanceOwner.address,
      "governance_safe address",
      evmAddressPattern
    );
  }

  if (!anchorSigner) {
    errors.push(`manifest.signers must include ${signerScope}.`);
  } else {
    pushIfPatternMismatch(
      errors,
      anchorSigner.signerAddress,
      `${signerScope} signerAddress`,
      evmAddressPattern
    );
    pushIfMissing(
      errors,
      anchorSigner.keyReference,
      `${signerScope} keyReference`
    );
  }

  if (!anchorRegistry) {
    errors.push(`manifest.contracts must include ${contractProductSurface}.`);
  } else {
    if (anchorRegistry.legacyPath === true) {
      errors.push(`${contractProductSurface} cannot be marked legacyPath=true.`);
    }

    pushIfPatternMismatch(
      errors,
      anchorRegistry.address,
      `${contractProductSurface} address`,
      evmAddressPattern
    );
    pushIfPatternMismatch(
      errors,
      anchorRegistry.deploymentTxHash,
      `${contractProductSurface} deploymentTxHash`,
      evmTransactionHashPattern
    );
    pushIfPatternMismatch(
      errors,
      anchorRegistry.governanceOwner,
      `${contractProductSurface} governanceOwner`,
      evmAddressPattern
    );
    pushIfPatternMismatch(
      errors,
      anchorRegistry.authorizedAnchorer,
      `${contractProductSurface} authorizedAnchorer`,
      evmAddressPattern
    );
    pushIfPatternMismatch(
      errors,
      anchorRegistry.abiChecksumSha256,
      `${contractProductSurface} abiChecksumSha256`,
      sha256ChecksumPattern
    );
  }

  pushIfPatternMismatch(
    errors,
    manifestCommit,
    "manifest commit SHA",
    gitCommitShaPattern
  );

  if (
    governanceOwner &&
    anchorRegistry?.governanceOwner &&
    governanceOwner.address.toLowerCase() !==
      anchorRegistry.governanceOwner.toLowerCase()
  ) {
    errors.push(
      `${contractProductSurface} governanceOwner must match governance_safe address.`
    );
  }

  if (
    anchorSigner &&
    anchorRegistry?.authorizedAnchorer &&
    anchorSigner.signerAddress.toLowerCase() !==
      anchorRegistry.authorizedAnchorer.toLowerCase()
  ) {
    errors.push(
      `${contractProductSurface} authorizedAnchorer must match ${signerScope} signerAddress.`
    );
  }

  return errors;
}

function buildEvidencePayload({
  manifest,
  anchorRegistry,
  anchorSigner,
  manifestPath,
  manifestCommit,
  networkName,
  releaseIdentifier,
  status,
  summary,
  note,
  evidenceLinks
}) {
  return {
    evidenceType,
    environment: manifest.environment,
    status,
    releaseIdentifier,
    summary:
      summary ??
      `Solvency anchor registry deployment verified for ${releaseIdentifier}.`,
    note:
      note ??
      "Generated from governed custody deployment manifest after registry owner and authorized anchorer review.",
    runbookPath,
    evidenceLinks,
    evidencePayload: {
      proofKind: "manual_attestation",
      networkName,
      chainId: manifest.chainId,
      contractProductSurface,
      signerScope,
      contractAddress: anchorRegistry.address,
      deploymentTxHash: anchorRegistry.deploymentTxHash,
      governanceOwner: anchorRegistry.governanceOwner,
      authorizedAnchorer: anchorRegistry.authorizedAnchorer,
      anchorerKeyReference: anchorSigner.keyReference,
      anchorerSignerAddress: anchorSigner.signerAddress,
      abiChecksumSha256: anchorRegistry.abiChecksumSha256,
      manifestPath,
      manifestCommitSha: manifestCommit,
      blockExplorerUrl: anchorRegistry.blockExplorerUrl ?? "",
      anchoredSmokeTxHash: anchorRegistry.anchoredSmokeTxHash ?? ""
    }
  };
}

async function recordReleaseReadinessEvidence({ baseUrl, accessToken, proof }) {
  if (typeof fetch !== "function") {
    fail("Global fetch is unavailable; use Node.js 18 or newer to record evidence.");
  }

  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/release-readiness/internal/evidence`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(proof)
    }
  );
  const responseText = await response.text();
  let responseBody = null;

  if (responseText.trim().length > 0) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      typeof responseBody.message === "string"
        ? responseBody.message
        : responseText;

    fail(
      `Release-readiness evidence recording failed with HTTP ${response.status}: ${message}`
    );
  }

  return responseBody;
}

function buildPreflightUrl(baseUrl, proof) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint =
    "/release-readiness/internal/solvency-anchor-registry-deployment-proof";
  const params = new URLSearchParams({
    environment: proof.environment,
    chainId: String(proof.evidencePayload.chainId),
    networkName: proof.evidencePayload.networkName,
    manifestPath: proof.evidencePayload.manifestPath,
    manifestCommitSha: proof.evidencePayload.manifestCommitSha,
    releaseIdentifier: proof.releaseIdentifier
  });

  return `${normalizedBaseUrl}${endpoint}?${params.toString()}`;
}

async function fetchSolvencyAnchorRegistryPreflight({
  baseUrl,
  accessToken,
  proof
}) {
  if (typeof fetch !== "function") {
    fail("Global fetch is unavailable; use Node.js 18 or newer to preflight evidence.");
  }

  const response = await fetch(buildPreflightUrl(baseUrl, proof), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  const responseText = await response.text();
  let responseBody = null;

  if (responseText.trim().length > 0) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      typeof responseBody.message === "string"
        ? responseBody.message
        : responseText;

    fail(
      `Solvency anchor registry proof preflight failed with HTTP ${response.status}: ${message}`
    );
  }

  if (
    !responseBody ||
    typeof responseBody !== "object" ||
    !responseBody.data ||
    typeof responseBody.data !== "object"
  ) {
    fail("Solvency anchor registry proof preflight response did not include data.");
  }

  return responseBody.data;
}

function describePreflightBlockers(preflight) {
  const blockers = Array.isArray(preflight.blockers) ? preflight.blockers : [];
  const requiredOperatorInputs = Array.isArray(preflight.requiredOperatorInputs)
    ? preflight.requiredOperatorInputs
    : [];

  return [
    ...blockers.map((blocker) => `- ${blocker}`),
    ...requiredOperatorInputs.map((input) => `- Missing operator input: ${input}.`)
  ];
}

function assertDraftFieldMatches(errors, draft, proof, field) {
  if (draft[field] !== proof[field]) {
    errors.push(`draft ${field} does not match generated proof ${field}.`);
  }
}

function assertDraftPayloadFieldMatches(errors, draftPayload, proofPayload, field) {
  if (String(draftPayload[field]) !== String(proofPayload[field])) {
    errors.push(
      `draft evidencePayload.${field} does not match generated proof evidencePayload.${field}.`
    );
  }
}

function assertPreflightMatchesProof(preflight, proof) {
  const errors = [];
  const draft = preflight.evidenceRequestDraft?.body;

  if (!preflight.ready || !preflight.evidenceRequestDraft?.recordable) {
    fail(
      [
        "Solvency anchor registry proof preflight is not recordable:",
        ...describePreflightBlockers(preflight)
      ].join("\n")
    );
  }

  if (!draft || typeof draft !== "object") {
    fail("Solvency anchor registry proof preflight did not return a draft body.");
  }

  assertDraftFieldMatches(errors, draft, proof, "evidenceType");
  assertDraftFieldMatches(errors, draft, proof, "environment");
  assertDraftFieldMatches(errors, draft, proof, "releaseIdentifier");

  for (const field of [
    "proofKind",
    "networkName",
    "chainId",
    "contractProductSurface",
    "signerScope",
    "contractAddress",
    "deploymentTxHash",
    "governanceOwner",
    "authorizedAnchorer",
    "abiChecksumSha256",
    "manifestPath",
    "manifestCommitSha"
  ]) {
    assertDraftPayloadFieldMatches(
      errors,
      draft.evidencePayload ?? {},
      proof.evidencePayload,
      field
    );
  }

  if (errors.length > 0) {
    fail(
      [
        "Solvency anchor registry proof preflight drifted from generated proof:",
        ...errors.map((error) => `- ${error}`)
      ].join("\n")
    );
  }
}

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));

  if (parsedArgs.help === true) {
    printUsage();
    return;
  }

  const manifestArg = readRequiredStringArg(parsedArgs, "manifest");
  const releaseIdentifier = readRequiredStringArg(parsedArgs, "release-id");
  const manifestCommit = readRequiredStringArg(parsedArgs, "manifest-commit");
  const status = readOptionalStringArg(parsedArgs, "status") ?? "passed";

  if (status !== "passed" && status !== "failed") {
    fail("--status must be passed or failed.");
  }

  const { relativePath, manifest } = readManifest(manifestArg);
  const anchorRegistry = findAnchorRegistry(manifest);
  const anchorSigner = findAnchorSigner(manifest);
  const governanceOwner = findGovernanceOwner(manifest);
  const validationErrors = validateManifestForProof({
    manifest,
    anchorRegistry,
    anchorSigner,
    governanceOwner,
    manifestCommit
  });

  if (validationErrors.length > 0) {
    fail(
      [
        "Cannot build solvency anchor registry release evidence:",
        ...validationErrors.map((error) => `- ${error}`)
      ].join("\n")
    );
  }

  const proof = buildEvidencePayload({
    manifest,
    anchorRegistry,
    anchorSigner,
    manifestPath: relativePath,
    manifestCommit,
    networkName:
      readOptionalStringArg(parsedArgs, "network-name") ?? manifest.environment,
    releaseIdentifier,
    status,
    summary: readOptionalStringArg(parsedArgs, "summary"),
    note: readOptionalStringArg(parsedArgs, "note"),
    evidenceLinks: parseEvidenceLinks(
      readOptionalStringArg(parsedArgs, "evidence-links")
    )
  });
  const output = JSON.stringify(proof, null, 2) + "\n";
  const outputPath = readOptionalStringArg(parsedArgs, "output");
  const shouldRecordEvidence = readOptionalBooleanFlag(
    parsedArgs,
    "record-evidence"
  );
  const shouldPreflightEvidence =
    readOptionalBooleanFlag(parsedArgs, "preflight") ||
    readOptionalBooleanFlag(parsedArgs, "preflight-only") ||
    (shouldRecordEvidence &&
      !readOptionalBooleanFlag(parsedArgs, "skip-preflight"));
  const shouldPreflightOnly = readOptionalBooleanFlag(
    parsedArgs,
    "preflight-only"
  );
  let preflight = null;

  if (shouldPreflightEvidence) {
    const baseUrl = readRequiredStringArg(parsedArgs, "base-url");
    const accessToken = readRequiredStringArg(parsedArgs, "access-token");

    preflight = await fetchSolvencyAnchorRegistryPreflight({
      baseUrl,
      accessToken,
      proof
    });

    if (status === "passed") {
      assertPreflightMatchesProof(preflight, proof);
    }
  }

  if (outputPath) {
    writeFileSync(path.resolve(resolveRepoRoot(), outputPath), output, "utf8");
  }

  if (shouldPreflightOnly) {
    process.stdout.write(
      JSON.stringify(
        {
          generatedProof: proof,
          preflight
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  if (!shouldRecordEvidence) {
    process.stdout.write(
      preflight
        ? JSON.stringify(
            {
              generatedProof: proof,
              preflight
            },
            null,
            2
          ) + "\n"
        : output
    );
    return;
  }

  const baseUrl = readRequiredStringArg(parsedArgs, "base-url");
  const accessToken = readRequiredStringArg(parsedArgs, "access-token");
  const recordedEvidence = await recordReleaseReadinessEvidence({
    baseUrl,
    accessToken,
    proof
  });

  process.stdout.write(
    JSON.stringify(
      {
        generatedProof: proof,
        preflight,
        recordedEvidence
      },
      null,
      2
    ) + "\n"
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
