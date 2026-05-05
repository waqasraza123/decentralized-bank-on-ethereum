#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

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
  "CustomerMfaRecoveryRequest",
  "Operator",
  "OperatorRoleAssignment",
  "OperatorEnvironmentAccess",
  "OperatorSessionAudit"
];
const POSTGRES_17_BIN_DIR_CANDIDATES = [
  "/usr/local/opt/postgresql@17/bin",
  "/opt/homebrew/opt/postgresql@17/bin"
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
      (value.startsWith('"') && value.endsWith('"')) ||
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

function hostnameLooksNeon(hostname) {
  return hostname.toLowerCase().endsWith(".neon.tech");
}

function hostnameLooksPooledNeon(hostname) {
  return hostname.toLowerCase().includes("-pooler.") && hostnameLooksNeon(hostname);
}

function hostnameLooksPooledSupabase(hostname) {
  return hostname.toLowerCase().endsWith(".pooler.supabase.com");
}

function hostnameLooksUnpooledNeon(hostname) {
  return !hostname.toLowerCase().includes("-pooler.") && hostnameLooksNeon(hostname);
}

function resolveSourceDatabaseUrl(apiEnv) {
  return readRequiredEnvValue("SOURCE_DATABASE_URL", apiEnv);
}

function resolveTargetRuntimeDatabaseUrl(apiEnv) {
  return readRequiredEnvValue("DATABASE_URL", apiEnv);
}

function resolveTargetDirectDatabaseUrl(apiEnv) {
  return readRequiredEnvValue("DIRECT_URL", apiEnv);
}

function resolveSourceSchemas(apiEnv) {
  const rawValue = readEnvValue("SOURCE_SCHEMAS", apiEnv).trim() || "public";
  const schemas = rawValue
    .split(",")
    .map((schemaName) => schemaName.trim())
    .filter(Boolean);

  if (schemas.length === 0) {
    fail(["SOURCE_SCHEMAS must include at least one schema name."]);
  }

  return schemas;
}

function buildApiCommandEnv(apiEnv) {
  return {
    ...process.env,
    DATABASE_URL: resolveTargetRuntimeDatabaseUrl(apiEnv),
    DIRECT_URL: resolveTargetDirectDatabaseUrl(apiEnv)
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

function resolvePostgresClientBinary(name) {
  const override = process.env[`${name.toUpperCase()}_BIN`]?.trim();

  if (override) {
    return override;
  }

  for (const binDir of POSTGRES_17_BIN_DIR_CANDIDATES) {
    const candidate = path.join(binDir, name);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return name;
}

function resolveDumpPath(rawPath) {
  if (!rawPath || rawPath === "--") {
    return path.join("/tmp", "stealth-trails-bank-neon-source.dump");
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

  const sourceUrl = parseDatabaseUrl(sourceDatabaseUrl, "SOURCE_DATABASE_URL");
  const runtimeUrl = parseDatabaseUrl(runtimeDatabaseUrl, "DATABASE_URL");
  const directUrl = parseDatabaseUrl(directDatabaseUrl, "DIRECT_URL");

  if (!hostnameLooksNeon(runtimeUrl.hostname)) {
    fail([
      "DATABASE_URL does not look like a Neon Postgres host.",
      `Resolved host: ${runtimeUrl.hostname}`
    ]);
  }

  if (!hostnameLooksPooledNeon(runtimeUrl.hostname)) {
    fail([
      "DATABASE_URL must use the Neon pooled runtime host with the -pooler suffix.",
      `Resolved host: ${runtimeUrl.hostname}`
    ]);
  }

  if (!hostnameLooksNeon(directUrl.hostname)) {
    fail([
      "DIRECT_URL does not look like a Neon Postgres host.",
      `Resolved host: ${directUrl.hostname}`
    ]);
  }

  if (!hostnameLooksUnpooledNeon(directUrl.hostname)) {
    fail([
      "DIRECT_URL must use the unpooled Neon host for pg_dump, pg_restore, and Prisma migrations.",
      `Resolved host: ${directUrl.hostname}`
    ]);
  }

  console.log("Neon cutover environment looks ready.");
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

function dumpSource(rawOutputPath) {
  const apiEnv = loadApiEnvFileValues();
  const sourceDatabaseUrl = resolveSourceDatabaseUrl(apiEnv);
  const sourceUrl = parseDatabaseUrl(sourceDatabaseUrl, "SOURCE_DATABASE_URL");
  const sourceSchemas = resolveSourceSchemas(apiEnv);

  if (hostnameLooksPooledNeon(sourceUrl.hostname)) {
    fail([
      "Refusing to export through a pooled source connection.",
      "Use an unpooled source connection for pg_dump."
    ]);
  }

  if (
    hostnameLooksPooledSupabase(sourceUrl.hostname) &&
    sourceUrl.port !== "5432"
  ) {
    fail([
      "Refusing to export through the Supabase transaction pooler.",
      "Use the Supabase direct host or session-mode pooler on port 5432 for pg_dump."
    ]);
  }

  const outputPath = resolveDumpPath(rawOutputPath);
  ensureParentDirectory(outputPath);

  runCommand(
    resolvePostgresClientBinary("pg_dump"),
    [
      "-Fc",
      "-v",
      "--no-owner",
      "--no-acl",
      ...sourceSchemas.flatMap((schemaName) => ["--schema", schemaName]),
      "--dbname",
      sourceDatabaseUrl,
      "-f",
      outputPath
    ],
    {
      stdio: "inherit"
    }
  );

  console.log(`Source PostgreSQL data exported to ${outputPath}`);
}

function restoreDump(rawInputPath) {
  const apiEnv = loadApiEnvFileValues();
  printCheckEnvSummary();

  if (!rawInputPath) {
    fail(["Provide the dump path: node scripts/neon-db-cutover.mjs restore <dump-file>"]);
  }

  const inputPath = resolveDumpPath(rawInputPath);

  if (!existsSync(inputPath)) {
    fail([`Dump file not found: ${inputPath}`]);
  }

  runCommand(
    resolvePostgresClientBinary("pg_restore"),
    [
      "-v",
      "--no-owner",
      "--no-acl",
      "--dbname",
      resolveTargetDirectDatabaseUrl(apiEnv),
      inputPath
    ],
    {
      stdio: "inherit"
    }
  );
}

function readPublicTableNames(databaseUrl, label) {
  const result = runCommand(
    resolvePostgresClientBinary("psql"),
    [
      databaseUrl,
      "-At",
      "-c",
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
    ],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const tableNames = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (tableNames.length === 0) {
    fail([`No public tables found in ${label}.`]);
  }

  return tableNames;
}

function buildCountQuery(tableNames) {
  return tableNames.map(
    (tableName, index) =>
      `SELECT ${index + 1} AS ordinal, '${tableName.replaceAll("'", "''")}' AS table_name, count(*)::bigint AS row_count FROM "${tableName.replaceAll('"', '""')}"`
  ).join("\nUNION ALL\n") + "\nORDER BY ordinal;";
}

function readTableCounts(databaseUrl, tableNames, label) {
  const query = buildCountQuery(tableNames);
  const result = runCommand(
    resolvePostgresClientBinary("psql"),
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

  if (tableCounts.size !== tableNames.length) {
    fail([
      `Unable to read all table counts from ${label}.`,
      result.stdout.trim()
    ]);
  }

  return tableCounts;
}

function compareTableCounts(tableScope) {
  const apiEnv = loadApiEnvFileValues();
  printCheckEnvSummary();

  const sourceDatabaseUrl = resolveSourceDatabaseUrl(apiEnv);
  const targetDatabaseUrl = resolveTargetDirectDatabaseUrl(apiEnv);
  const sourceTableNames = readPublicTableNames(sourceDatabaseUrl, "source");
  const targetTableNames = readPublicTableNames(targetDatabaseUrl, "target");
  const tableNames =
    tableScope === "critical"
      ? CRITICAL_TABLES
      : sourceTableNames.filter((tableName) => tableName !== "_prisma_migrations");
  const missingOnTarget = tableNames.filter((tableName) => !targetTableNames.includes(tableName));

  if (missingOnTarget.length > 0) {
    fail(["Target is missing expected public tables.", ...missingOnTarget]);
  }

  const sourceCounts = readTableCounts(sourceDatabaseUrl, tableNames, "source");
  const targetCounts = readTableCounts(targetDatabaseUrl, tableNames, "target");
  const mismatches = [];

  for (const tableName of tableNames) {
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
      `${tableScope === "critical" ? "Critical" : "All"}-table row-count comparison failed.`,
      ...mismatches
    ]);
  }

  console.log(`${tableScope === "critical" ? "Critical" : "All"} public-table row counts match between source and Neon target.`);
  for (const tableName of tableNames) {
    console.log(`${tableName}: ${sourceCounts.get(tableName)}`);
  }
}

function printUsage() {
  console.log(`Usage:
  node scripts/neon-db-cutover.mjs check-env
  node scripts/neon-db-cutover.mjs migrate
  node scripts/neon-db-cutover.mjs dump-source [output.dump]
  node scripts/neon-db-cutover.mjs restore <dump-file>
  node scripts/neon-db-cutover.mjs compare-counts
  node scripts/neon-db-cutover.mjs compare-all-counts

Environment:
  SOURCE_DATABASE_URL  Required. Direct/unpooled source PostgreSQL URL, typically Supabase direct URL.
  SOURCE_SCHEMAS       Optional. Comma-separated schemas to dump. Defaults to public.
  DATABASE_URL         Required. Neon pooled runtime URL, with the -pooler host suffix.
  DIRECT_URL           Required. Neon direct/unpooled URL for restore and migrations.
`);
}

function main() {
  const command = process.argv[2];
  const firstArgument = process.argv[3] === "--" ? process.argv[4] : process.argv[3];

  switch (command) {
    case "check-env":
      printCheckEnvSummary();
      return;
    case "migrate":
      deployPrismaMigrations();
      return;
    case "dump-source":
      dumpSource(firstArgument);
      return;
    case "restore":
      restoreDump(firstArgument);
      return;
    case "compare-counts":
      compareTableCounts("critical");
      return;
    case "compare-all-counts":
      compareTableCounts("all");
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
