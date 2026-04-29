import { readFileSync } from "node:fs";
import path from "node:path";

const packageRoot = process.cwd();
const manifestPaths = [
  "deployments/local.manifest.json",
  "deployments/base-sepolia.manifest.json",
  "deployments/base-mainnet.manifest.json"
];

function fail(message) {
  throw new Error(message);
}

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const evmTransactionHashPattern = /^0x[a-fA-F0-9]{64}$/;
const sha256ChecksumPattern = /^(sha256:)?[a-fA-F0-9]{64}$/;
const solvencyAnchorProductSurface = "solvency_report_anchor_registry_v1";
const solvencyAnchorSignerScope = "solvency_anchor_execution";

function assertOptionalPattern(value, label, pattern) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string" || !pattern.test(value.trim())) {
    fail(`${label} is malformed.`);
  }
}

for (const relativePath of manifestPaths) {
  const absolutePath = path.join(packageRoot, relativePath);
  const manifest = JSON.parse(readFileSync(absolutePath, "utf8"));

  if (!manifest.environment || !manifest.chainId) {
    fail(`${relativePath} must define environment and chainId.`);
  }

  if (!Array.isArray(manifest.authorities) || manifest.authorities.length !== 3) {
    fail(`${relativePath} must define exactly three authorities.`);
  }

  if (!Array.isArray(manifest.signers) || manifest.signers.length < 5) {
    fail(`${relativePath} must define at least five governed signers.`);
  }

  const solvencyAnchorSigner = manifest.signers.find(
    (signer) => signer.scope === solvencyAnchorSignerScope
  );

  if (!solvencyAnchorSigner) {
    fail(`${relativePath} must define ${solvencyAnchorSignerScope} signer.`);
  } else if (!evmAddressPattern.test(solvencyAnchorSigner.signerAddress ?? "")) {
    fail(`${relativePath} ${solvencyAnchorSignerScope}.signerAddress is malformed.`);
  }

  if (!Array.isArray(manifest.contracts) || manifest.contracts.length < 3) {
    fail(
      `${relativePath} must define staking_v1, loan_book_v1, and solvency_report_anchor_registry_v1 contracts.`
    );
  }

  for (const contract of manifest.contracts) {
    if (!contract.productSurface || !contract.version || !contract.address) {
      fail(
        `${relativePath} contract entries must include productSurface, version, and address.`
      );
    }

    if (contract.legacyPath === true) {
      fail(`${relativePath} cannot mark production v1 contracts as legacyPath=true.`);
    }

    assertOptionalPattern(
      contract.deploymentTxHash,
      `${relativePath} ${contract.productSurface}.deploymentTxHash`,
      evmTransactionHashPattern
    );
    assertOptionalPattern(
      contract.governanceOwner,
      `${relativePath} ${contract.productSurface}.governanceOwner`,
      evmAddressPattern
    );
    assertOptionalPattern(
      contract.authorizedAnchorer,
      `${relativePath} ${contract.productSurface}.authorizedAnchorer`,
      evmAddressPattern
    );

    if (
      contract.productSurface === solvencyAnchorProductSurface &&
      contract.authorizedAnchorer &&
      solvencyAnchorSigner &&
      contract.authorizedAnchorer.toLowerCase() !==
        solvencyAnchorSigner.signerAddress.toLowerCase()
    ) {
      fail(
        `${relativePath} ${solvencyAnchorProductSurface}.authorizedAnchorer must match ${solvencyAnchorSignerScope} signerAddress.`
      );
    }

    if (
      contract.productSurface === solvencyAnchorProductSurface &&
      contract.abiChecksumSha256 &&
      contract.deploymentTxHash &&
      !sha256ChecksumPattern.test(contract.abiChecksumSha256)
    ) {
      fail(
        `${relativePath} ${solvencyAnchorProductSurface}.abiChecksumSha256 must be a real SHA-256 checksum once deploymentTxHash is recorded.`
      );
    }
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      manifestsValidated: manifestPaths
    },
    null,
    2
  )
);
