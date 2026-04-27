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

function main() {
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

  if (outputPath) {
    writeFileSync(path.resolve(resolveRepoRoot(), outputPath), output, "utf8");
  }

  process.stdout.write(output);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
