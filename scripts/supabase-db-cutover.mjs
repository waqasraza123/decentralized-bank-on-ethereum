#!/usr/bin/env node

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const CRITICAL_TABLES = [
  "Customer",
  "CustomerAccount",
  "CustomerAuthSession",
  "Wallet",
  "TransactionIntent",
  "LedgerJournal",
  "ReviewCase",
  "OversightIncident",
  "AuditEvent",
  "CustomerMfaRecoveryRequest"
];

function repoRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
}

function fail(messageLines) {
  for (const line of messageLines) {
    console.error(line);
  }

  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const result = {};
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadApiEnvFileValues() {
  return parseEnvFile(path.join(repoRoot(), "apps/api/.env"));
}

function readEnvValue(name, apiEnv) {
  return process.env[name] ?? apiEnv[name] ?? "";
}

function readRequiredEnvValue(name, apiEnv) {
  const value = readEnvValue(name, apiEnv).trim();

  if (!value) {
    fail([`Missing required environment variable: ${name}`]);
  }

  return value;
}

function parseDatabaseUrl(rawValue, name) {
  try {
    return new URL(rawValue);
  } catch {
    fail([`${name} must be a valid absolute PostgreSQL connection string.`]);
  }
}

function hostnameLooksLocal(hostname) {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

function hostnameLooksSupabase(hostname) {
  return hostname.toLowerCase().includes("supabase");
}

function resolveSourceDatabaseUrl(apiEnv) {
  const sourceDatabaseUrl =
    process.env["SOURCE_DATABASE_URL"]?.trim() ??
    apiEnv["DATABASE_URL"]?.trim() ??
    "";

  if (!sourceDatabaseUrl) {
    fail([
      "SOURCE_DATABASE_URL is required for local export or row-count comparison.",
      "Set SOURCE_DATABASE_URL explicitly or keep apps/api/.env pointed at the current local PostgreSQL source."
    ]);
  }

  return sourceDatabaseUrl;
}

function resolveTargetRuntimeDatabaseUrl(apiEnv) {
  return readRequiredEnvValue("DATABASE_URL", apiEnv);
}

function resolveTargetDirectDatabaseUrl(apiEnv) {
  return readRequiredEnvValue("DIRECT_URL", apiEnv);
}

function resolveSupabaseJwtSecret(apiEnv) {
  return readRequiredEnvValue("SUPABASE_JWT_SECRET", apiEnv);
}

function buildApiCommandEnv(apiEnv) {
  return {
    ...process.env,
    DATABASE_URL: resolveTargetRuntimeDatabaseUrl(apiEnv),
    DIRECT_URL: resolveTargetDirectDatabaseUrl(apiEnv),
    SUPABASE_JWT_SECRET: resolveSupabaseJwtSecret(apiEnv)
  };
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot(),
    encoding: "utf8",
    ...options
  });

  if (result.error) {
    fail([result.error.message]);
  }

  if (result.status !== 0) {
    fail([
      `${command} ${args.join(" ")} failed.`,
      result.stdout?.trim() ?? "",
      result.stderr?.trim() ?? ""
    ].filter(Boolean));
  }

  return result;
}

function resolveOutputPath(rawPath) {
  if (!rawPath) {
    return path.join("/tmp", "stealth-trails-bank-supabase-data.sql");
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.join(repoRoot(), rawPath);
}

function ensureParentDirectory(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function printCheckEnvSummary() {
  const apiEnv = loadApiEnvFileValues();
  const sourceDatabaseUrl = resolveSourceDatabaseUrl(apiEnv);
  const runtimeDatabaseUrl = resolveTargetRuntimeDatabaseUrl(apiEnv);
  const directDatabaseUrl = resolveTargetDirectDatabaseUrl(apiEnv);
  resolveSupabaseJwtSecret(apiEnv);

  const sourceUrl = parseDatabaseUrl(sourceDatabaseUrl, "SOURCE_DATABASE_URL");
  const runtimeUrl = parseDatabaseUrl(runtimeDatabaseUrl, "DATABASE_URL");
  const directUrl = parseDatabaseUrl(directDatabaseUrl, "DIRECT_URL");

  if (!hostnameLooksLocal(sourceUrl.hostname)) {
    fail([
      "SOURCE_DATABASE_URL must still point at the current local PostgreSQL source before cutover export.",
      `Resolved host: ${sourceUrl.hostname}`
    ]);
  }

  if (hostnameLooksLocal(runtimeUrl.hostname)) {
    fail([
      "DATABASE_URL still points at localhost. Replace it with the Supabase pooled/runtime URL.",
      `Resolved host: ${runtimeUrl.hostname}`
    ]);
  }

  if (hostnameLooksLocal(directUrl.hostname)) {
    fail([
      "DIRECT_URL still points at localhost. Replace it with the Supabase direct Postgres URL.",
      `Resolved host: ${directUrl.hostname}`
    ]);
  }

  if (!hostnameLooksSupabase(runtimeUrl.hostname)) {
    fail([
      "DATABASE_URL does not look like a Supabase Postgres host.",
      `Resolved host: ${runtimeUrl.hostname}`
    ]);
  }

  if (!hostnameLooksSupabase(directUrl.hostname)) {
    fail([
      "DIRECT_URL does not look like a Supabase Postgres host.",
      `Resolved host: ${directUrl.hostname}`
    ]);
  }

  console.log("Supabase cutover environment looks ready.");
  console.log(`Source database host: ${sourceUrl.hostname}`);
  console.log(`Target runtime host: ${runtimeUrl.hostname}`);
  console.log(`Target direct host: ${directUrl.hostname}`);
}

function deployPrismaMigrations() {
  const apiEnv = loadApiEnvFileValues();
  printCheckEnvSummary();
  runCommand(
    "pnpm",
    ["--filter", "@stealth-trails-bank/api", "prisma:deploy"],
    {
      env: buildApiCommandEnv(apiEnv),
      stdio: "inherit"
    }
  );
}

function dumpLocalData(rawOutputPath) {
  const apiEnv = loadApiEnvFileValues();
  const sourceDatabaseUrl = resolveSourceDatabaseUrl(apiEnv);
  const sourceUrl = parseDatabaseUrl(sourceDatabaseUrl, "SOURCE_DATABASE_URL");

  if (!hostnameLooksLocal(sourceUrl.hostname)) {
    fail([
      "Refusing to export because SOURCE_DATABASE_URL is not a localhost database.",
      `Resolved host: ${sourceUrl.hostname}`
    ]);
  }

  const outputPath = resolveOutputPath(rawOutputPath);
  ensureParentDirectory(outputPath);

  const result = runCommand(
    "pg_dump",
    [
      "--data-only",
      "--column-inserts",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      sourceDatabaseUrl
    ],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  writeFileSync(outputPath, result.stdout, "utf8");
  console.log(`Local PostgreSQL data exported to ${outputPath}`);
}

function importDump(rawInputPath) {
  const apiEnv = loadApiEnvFileValues();
  printCheckEnvSummary();

  if (!rawInputPath) {
    fail(["Provide the SQL dump path: node scripts/supabase-db-cutover.mjs import-data <dump.sql>"]);
  }

  const inputPath = resolveOutputPath(rawInputPath);

  if (!existsSync(inputPath)) {
    fail([`Dump file not found: ${inputPath}`]);
  }

  runCommand(
    "psql",
    [resolveTargetDirectDatabaseUrl(apiEnv), "-f", inputPath],
    {
      stdio: "inherit"
    }
  );
}

function buildCountQuery() {
  return CRITICAL_TABLES.map(
    (tableName, index) =>
      `SELECT ${index + 1} AS ordinal, '${tableName}' AS table_name, count(*)::bigint AS row_count FROM "${tableName}"`
  ).join("\nUNION ALL\n") + "\nORDER BY ordinal;";
}

function readTableCounts(databaseUrl, label) {
  const query = buildCountQuery();
  const result = runCommand(
    "psql",
    [databaseUrl, "-At", "-F", "\t", "-c", query],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const tableCounts = new Map();

  for (const rawLine of result.stdout.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const [, tableName, countText] = line.split("\t");
    tableCounts.set(tableName, Number(countText));
  }

  if (tableCounts.size !== CRITICAL_TABLES.length) {
    fail([
      `Unable to read all critical-table counts from ${label}.`,
      result.stdout.trim()
    ]);
  }

  return tableCounts;
}

function compareCriticalTableCounts() {
  const apiEnv = loadApiEnvFileValues();
  printCheckEnvSummary();

  const sourceDatabaseUrl = resolveSourceDatabaseUrl(apiEnv);
  const targetDatabaseUrl = resolveTargetDirectDatabaseUrl(apiEnv);
  const sourceCounts = readTableCounts(sourceDatabaseUrl, "source");
  const targetCounts = readTableCounts(targetDatabaseUrl, "target");
  const mismatches = [];

  for (const tableName of CRITICAL_TABLES) {
    const sourceCount = sourceCounts.get(tableName);
    const targetCount = targetCounts.get(tableName);

    if (sourceCount !== targetCount) {
      mismatches.push(
        `${tableName}: source=${sourceCount ?? "?"}, target=${targetCount ?? "?"}`
      );
    }
  }

  if (mismatches.length > 0) {
    fail([
      "Critical-table row-count comparison failed.",
      ...mismatches
    ]);
  }

  console.log("Critical-table row counts match between source and Supabase target.");
  for (const tableName of CRITICAL_TABLES) {
    console.log(`${tableName}: ${sourceCounts.get(tableName)}`);
  }
}

function printUsage() {
  console.log(`Usage:
  node scripts/supabase-db-cutover.mjs check-env
  node scripts/supabase-db-cutover.mjs migrate
  node scripts/supabase-db-cutover.mjs dump-local [output.sql]
  node scripts/supabase-db-cutover.mjs import-data <dump.sql>
  node scripts/supabase-db-cutover.mjs compare-counts

Environment:
  SOURCE_DATABASE_URL  Optional. Defaults to apps/api/.env DATABASE_URL for local export/compare.
  DATABASE_URL         Required. Supabase pooled/runtime Postgres URL.
  DIRECT_URL           Required. Supabase direct Postgres URL.
  SUPABASE_JWT_SECRET  Required. Supabase JWT secret for the target project.
`);
}

function main() {
  const command = process.argv[2];

  switch (command) {
    case "check-env":
      printCheckEnvSummary();
      return;
    case "migrate":
      deployPrismaMigrations();
      return;
    case "dump-local":
      dumpLocalData(process.argv[3]);
      return;
    case "import-data":
      importDump(process.argv[3]);
      return;
    case "compare-counts":
      compareCriticalTableCounts();
      return;
    case "--help":
    case "-h":
    case undefined:
      printUsage();
      return;
    default:
      fail([`Unknown command: ${command}`]);
  }
}

main();
