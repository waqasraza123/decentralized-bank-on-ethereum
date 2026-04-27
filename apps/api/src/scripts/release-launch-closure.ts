import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  mergeLaunchClosureSolvencyFragment,
  loadLaunchClosureManifest,
  renderPhase12CompletionChecklist,
  renderLaunchClosureStatusSummary,
  renderLaunchClosureValidationSummary,
  scaffoldLaunchClosurePack,
  validateLaunchClosureManifest,
  type LaunchClosureManifest,
  type LaunchClosureSolvencyFragment
} from "../release-readiness/launch-closure-pack";

type ParsedArgs = {
  [key: string]: string | boolean | undefined;
};

function invocationCwd(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @stealth-trails-bank/api release-launch-closure -- <command> [options]

Commands:
  checklist [--manifest <path>]
  status
  validate --manifest <path> [--solvency-fragment <path>]
  scaffold --manifest <path> [--solvency-fragment <path>] [--output-dir <path>] [--force]
  merge-solvency-fragment --manifest <path> --solvency-fragment <path> --output <path>

Options:
  --manifest                     Path to a launch-closure manifest JSON file
  --solvency-fragment            Path to generated solvency launch fragment JSON
  --output                       Output path for a merged launch-closure manifest
  --output-dir                   Output directory for generated pack artifacts
  --force                        Remove an existing output directory before scaffold
  --help                         Print this message
`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  command: string | undefined;
  parsedArgs: ParsedArgs;
} {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [command, ...rest] = normalizedArgv;
  const parsedArgs: ParsedArgs = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = rest[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      parsedArgs[key] = true;
      continue;
    }

    parsedArgs[key] = nextToken;
    index += 1;
  }

  return {
    command,
    parsedArgs
  };
}

function readRequiredStringArg(parsedArgs: ParsedArgs, key: string): string {
  const value = parsedArgs[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`Missing required argument --${key}.`);
  }

  return value.trim();
}

function readOptionalStringArg(
  parsedArgs: ParsedArgs,
  key: string
): string | undefined {
  const value = parsedArgs[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readOptionalBooleanFlag(parsedArgs: ParsedArgs, key: string): boolean {
  return parsedArgs[key] === true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function loadManifest(parsedArgs: ParsedArgs) {
  const manifestPath = path.resolve(
    invocationCwd(),
    readRequiredStringArg(parsedArgs, "manifest")
  );

  try {
    return loadLaunchClosureManifest(manifestPath);
  } catch (error) {
    fail(
      `Failed to read launch-closure manifest ${manifestPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function loadJsonFile<T>(filePath: string, label: string): T {
  const absolutePath = path.resolve(invocationCwd(), filePath);

  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
  } catch (error) {
    fail(
      `Failed to read ${label} ${absolutePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function loadSolvencyFragment(
  parsedArgs: ParsedArgs
): LaunchClosureSolvencyFragment | undefined {
  const fragmentPath = readOptionalStringArg(parsedArgs, "solvency-fragment");

  if (!fragmentPath) {
    return undefined;
  }

  const fragment = loadJsonFile<unknown>(
    fragmentPath,
    "solvency launch fragment"
  );

  if (!isPlainRecord(fragment)) {
    fail("Solvency launch fragment must be a JSON object.");
  }

  return fragment as LaunchClosureSolvencyFragment;
}

function loadMergedManifest(parsedArgs: ParsedArgs): LaunchClosureManifest {
  const manifest = loadManifest(parsedArgs);
  const solvencyFragment = loadSolvencyFragment(parsedArgs);

  if (!solvencyFragment) {
    return manifest;
  }

  return mergeLaunchClosureSolvencyFragment(manifest, solvencyFragment);
}

function writeMergedManifest(
  parsedArgs: ParsedArgs,
  manifest: LaunchClosureManifest
): void {
  const outputPath = path.resolve(
    invocationCwd(),
    readRequiredStringArg(parsedArgs, "output")
  );

  try {
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  } catch (error) {
    fail(
      `Failed to write merged launch-closure manifest ${outputPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function main(): void {
  const { command, parsedArgs } = parseArgs(process.argv.slice(2));

  if (!command || command === "--help" || parsedArgs.help === true) {
    printUsage();
    return;
  }

  if (command === "status") {
    console.log(renderLaunchClosureStatusSummary());
    return;
  }

  if (command === "checklist") {
    const manifest =
      typeof parsedArgs.manifest === "string"
        ? loadMergedManifest(parsedArgs)
        : undefined;
    console.log(
      renderPhase12CompletionChecklist({
        manifest
      })
    );
    return;
  }

  if (command === "validate") {
    const manifest = loadMergedManifest(parsedArgs);
    const summary = renderLaunchClosureValidationSummary(manifest);
    const validation = validateLaunchClosureManifest(manifest);
    console.log(summary);

    if (validation.errors.length > 0) {
      process.exit(1);
    }

    return;
  }

  if (command === "scaffold") {
    const manifest = loadMergedManifest(parsedArgs);
    const outputDir = readOptionalStringArg(parsedArgs, "output-dir");
    const result = scaffoldLaunchClosurePack({
      manifest,
      repoRoot: path.resolve(__dirname, "../../../../"),
      outputDir: outputDir ? path.resolve(invocationCwd(), outputDir) : undefined,
      force: readOptionalBooleanFlag(parsedArgs, "force")
    });

    console.log(
      JSON.stringify(
        {
          outputDir: result.outputDir,
          generatedFileCount: result.files.length,
          files: result.files
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "merge-solvency-fragment") {
    readRequiredStringArg(parsedArgs, "solvency-fragment");
    const manifest = loadMergedManifest(parsedArgs);
    const summary = renderLaunchClosureValidationSummary(manifest);
    const validation = validateLaunchClosureManifest(manifest);
    console.log(summary);

    if (validation.errors.length > 0) {
      process.exit(1);
    }

    writeMergedManifest(parsedArgs, manifest);
    console.log(
      JSON.stringify(
        {
          output: path.resolve(
            invocationCwd(),
            readRequiredStringArg(parsedArgs, "output")
          )
        },
        null,
        2
      )
    );
    return;
  }

  fail(`Unsupported command: ${command}.`);
}

main();
