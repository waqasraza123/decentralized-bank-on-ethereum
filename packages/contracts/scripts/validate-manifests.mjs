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

for (const relativePath of manifestPaths) {
  const absolutePath = path.join(packageRoot, relativePath);
  const manifest = JSON.parse(readFileSync(absolutePath, "utf8"));

  if (!manifest.environment || !manifest.chainId) {
    fail(`${relativePath} must define environment and chainId.`);
  }

  if (!Array.isArray(manifest.authorities) || manifest.authorities.length !== 3) {
    fail(`${relativePath} must define exactly three authorities.`);
  }

  if (!Array.isArray(manifest.signers) || manifest.signers.length < 4) {
    fail(`${relativePath} must define at least four governed signers.`);
  }

  if (!Array.isArray(manifest.contracts) || manifest.contracts.length < 2) {
    fail(`${relativePath} must define staking_v1 and loan_book_v1 contracts.`);
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
