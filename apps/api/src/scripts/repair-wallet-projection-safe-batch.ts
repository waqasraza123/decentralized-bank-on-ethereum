import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";

type ScriptOptions = {
  applyChanges: boolean;
  email?: string;
  limit?: number;
  exportManualReview: boolean;
  manualReviewOutputPath?: string;
};

type JsonObject = Record<string, unknown>;

type BatchStepKey =
  | "repairMissingCustomerProjection"
  | "repairMissingCustomerAccount"
  | "repairWalletOnly"
  | "postRepairAudit"
  | "manualReviewExport";

type BatchStepResult = {
  command: string;
  summary: JsonObject;
};

type BatchResult = {
  mode: "dry-run" | "apply";
  productChainId: number;
  filters: {
    email: string | null;
    limit: number | null;
  };
  steps: Partial<Record<BatchStepKey, BatchStepResult>>;
  manualReviewExport: {
    enabled: boolean;
    outputPath: string | null;
  };
};

const DEFAULT_MANUAL_REVIEW_OUTPUT_PATH =
  ".artifacts/wallet-manual-review-batch.json";

function parseOptions(argv: string[]): ScriptOptions {
  let applyChanges = false;
  let email: string | undefined;
  let limit: number | undefined;
  let exportManualReview = false;
  let manualReviewOutputPath: string | undefined;

  for (const argument of argv) {
    if (argument === "--apply") {
      applyChanges = true;
      continue;
    }

    if (argument === "--export-manual-review") {
      exportManualReview = true;
      continue;
    }

    if (argument.startsWith("--email=")) {
      const emailValue = argument.slice("--email=".length).trim();

      if (!emailValue) {
        throw new Error("The --email option requires a non-empty value.");
      }

      email = emailValue;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      const rawLimit = argument.slice("--limit=".length).trim();
      const parsedLimit = Number(rawLimit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        throw new Error("The --limit option must be a positive integer.");
      }

      limit = parsedLimit;
      continue;
    }

    if (argument.startsWith("--manual-review-output=")) {
      const outputValue = argument
        .slice("--manual-review-output=".length)
        .trim();

      if (!outputValue) {
        throw new Error(
          "The --manual-review-output option requires a non-empty value."
        );
      }

      manualReviewOutputPath = outputValue;
      exportManualReview = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    applyChanges,
    email,
    limit,
    exportManualReview,
    manualReviewOutputPath
  };
}

function buildSharedArgs(options: ScriptOptions): string[] {
  const args: string[] = [];

  if (options.email) {
    args.push(`--email=${options.email}`);
  }

  if (options.limit) {
    args.push(`--limit=${options.limit}`);
  }

  return args;
}

function extractJsonPayload(stdout: string): JsonObject {
  const trimmedOutput = stdout.trim();

  if (!trimmedOutput) {
    throw new Error("Command did not produce JSON output.");
  }

  try {
    return JSON.parse(trimmedOutput) as JsonObject;
  } catch {
    const firstBraceIndex = trimmedOutput.indexOf("{");
    const lastBraceIndex = trimmedOutput.lastIndexOf("}");

    if (firstBraceIndex === -1 || lastBraceIndex === -1) {
      throw new Error("Command output could not be parsed as JSON.");
    }

    const possibleJson = trimmedOutput.slice(firstBraceIndex, lastBraceIndex + 1);
    return JSON.parse(possibleJson) as JsonObject;
  }
}

function extractSummary(payload: JsonObject): JsonObject {
  const summary = payload["summary"];

  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("Command JSON output did not contain a summary object.");
  }

  return summary as JsonObject;
}

function runJsonScript(
  scriptFileName: string,
  scriptArgs: string[]
): { command: string; payload: JsonObject } {
  const scriptsDir = __dirname;
  const apiRootDir = resolve(scriptsDir, "..", "..");
  const scriptPath = resolve(scriptsDir, scriptFileName);
  const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only");
  const nodeArgs = ["-r", tsNodeRegisterPath, scriptPath, ...scriptArgs];

  const result = spawnSync(process.execPath, nodeArgs, {
    cwd: apiRootDir,
    encoding: "utf-8"
  });

  const command = [process.execPath, ...nodeArgs].join(" ");

  if (result.error) {
    throw new Error(
      `Failed to execute ${scriptFileName}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const errorOutput = [stderr, stdout].filter(Boolean).join("\n");

    throw new Error(
      `Step failed for ${scriptFileName}.\nCommand: ${command}\n${errorOutput}`
    );
  }

  return {
    command,
    payload: extractJsonPayload(result.stdout)
  };
}

function runRepairStep(
  scriptFileName: string,
  options: ScriptOptions
): BatchStepResult {
  const args = buildSharedArgs(options);

  if (options.applyChanges) {
    args.push("--apply");
  }

  const result = runJsonScript(scriptFileName, args);

  return {
    command: result.command,
    summary: extractSummary(result.payload)
  };
}

function runAuditSummaryStep(options: ScriptOptions): BatchStepResult {
  const args = [...buildSharedArgs(options), "--summary-only"];
  const result = runJsonScript("audit-wallet-projection-coverage.ts", args);

  return {
    command: result.command,
    summary: extractSummary(result.payload)
  };
}

function runManualReviewExportStep(options: ScriptOptions): BatchStepResult {
  const outputPath =
    options.manualReviewOutputPath ?? DEFAULT_MANUAL_REVIEW_OUTPUT_PATH;
  const args = [
    ...buildSharedArgs(options),
    "--format=json",
    `--output=${outputPath}`
  ];
  const result = runJsonScript(
    "export-wallet-projection-manual-review-queue.ts",
    args
  );

  return {
    command: result.command,
    summary: extractSummary(result.payload)
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const productChainId = loadProductChainRuntimeConfig().productChainId;

  const batchResult: BatchResult = {
    mode: options.applyChanges ? "apply" : "dry-run",
    productChainId,
    filters: {
      email: options.email ?? null,
      limit: options.limit ?? null
    },
    steps: {},
    manualReviewExport: {
      enabled: options.exportManualReview,
      outputPath: options.exportManualReview
        ? options.manualReviewOutputPath ?? DEFAULT_MANUAL_REVIEW_OUTPUT_PATH
        : null
    }
  };

  batchResult.steps.repairMissingCustomerProjection = runRepairStep(
    "repair-missing-customer-projections.ts",
    options
  );

  batchResult.steps.repairMissingCustomerAccount = runRepairStep(
    "repair-customer-account-wallet-projections.ts",
    options
  );

  batchResult.steps.repairWalletOnly = runRepairStep(
    "repair-customer-wallet-projections.ts",
    options
  );

  batchResult.steps.postRepairAudit = runAuditSummaryStep(options);

  if (options.exportManualReview) {
    batchResult.steps.manualReviewExport = runManualReviewExportStep(options);
  }

  console.log(JSON.stringify(batchResult, null, 2));
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    process.exit(1);
  }

  console.error("Wallet projection safe batch repair failed.");
  process.exit(1);
});
