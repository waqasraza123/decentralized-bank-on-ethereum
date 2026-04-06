import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vitePackageJsonPath = require.resolve("vite/package.json");
const vitePackageJson = require(vitePackageJsonPath);
const viteBin = path.resolve(
  path.dirname(vitePackageJsonPath),
  vitePackageJson.bin.vite,
);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(currentDir, "..");
const distAssetsDir = path.join(appDir, "dist", "assets");
const maxJsAssetBytes = 500_000;

const buildResult = spawnSync(process.execPath, [viteBin, "build"], {
  cwd: appDir,
  encoding: "utf8",
});

if (buildResult.stdout) {
  process.stdout.write(buildResult.stdout);
}

if (buildResult.stderr) {
  process.stderr.write(buildResult.stderr);
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const combinedOutput = `${buildResult.stdout ?? ""}\n${buildResult.stderr ?? ""}`;

if (
  combinedOutput.includes("warnings when minifying css") ||
  combinedOutput.includes("css-syntax-error")
) {
  console.error("Build failed: CSS minification emitted warnings.");
  process.exit(1);
}

const oversizedAssets = readdirSync(distAssetsDir)
  .filter((fileName) => fileName.endsWith(".js"))
  .map((fileName) => {
    const assetPath = path.join(distAssetsDir, fileName);
    return {
      fileName,
      size: statSync(assetPath).size,
    };
  })
  .filter((asset) => asset.size > maxJsAssetBytes);

if (oversizedAssets.length > 0) {
  for (const asset of oversizedAssets) {
    console.error(
      `Build failed: ${asset.fileName} is ${asset.size} bytes, exceeding the ${maxJsAssetBytes}-byte limit.`,
    );
  }

  process.exit(1);
}
