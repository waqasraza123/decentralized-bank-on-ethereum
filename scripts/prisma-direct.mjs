#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const apiDir = path.join(repoRoot, "apps", "api");
const apiEnvPath = path.join(apiDir, ".env");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
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

    values[key] = value;
  }

  return values;
}

function resolveDirectUrl() {
  const envFile = parseEnvFile(apiEnvPath);
  return process.env.DIRECT_URL?.trim() || envFile.DIRECT_URL?.trim() || "";
}

function classifyConnection(urlString) {
  try {
    const parsed = new URL(urlString);

    if (parsed.hostname.endsWith(".pooler.supabase.com")) {
      if (parsed.port === "6543") {
        return "supabase-transaction-pooler";
      }

      if (parsed.port === "5432" || parsed.port === "") {
        return "supabase-session-pooler";
      }

      return "supabase-pooler";
    }

    if (parsed.hostname.startsWith("db.") && parsed.hostname.endsWith(".supabase.co")) {
      return "supabase-direct";
    }

    if (parsed.hostname.endsWith(".neon.tech")) {
      if (parsed.hostname.includes("-pooler.")) {
        return "neon-pooler";
      }

      return "neon-direct";
    }

    return "other";
  } catch {
    return "invalid";
  }
}

function fail(messageLines) {
  for (const line of messageLines) {
    console.error(line);
  }

  process.exit(1);
}

function main() {
  const prismaArgs = process.argv.slice(2);

  if (prismaArgs.length === 0) {
    fail(["Usage: node ./scripts/prisma-direct.mjs <prisma args...>"]);
  }

  const directUrl = resolveDirectUrl();

  if (!directUrl) {
    fail([
      "Prisma migration connection is not configured.",
      "Set DIRECT_URL in apps/api/.env before running Prisma migrate commands.",
      "For Supabase, use either the direct Postgres URL or the Supavisor session-mode URL on port 5432."
    ]);
  }

  const connectionKind = classifyConnection(directUrl);

  if (connectionKind === "invalid") {
    fail([
      "DIRECT_URL is not a valid database URL.",
      `Resolved DIRECT_URL: ${directUrl}`
    ]);
  }

  if (connectionKind === "supabase-transaction-pooler") {
    fail([
      "DIRECT_URL is using the Supabase transaction pooler on port 6543, which is not valid for Prisma migrate/status.",
      `Resolved DIRECT_URL: ${directUrl}`,
      "Use either the direct Postgres host or the Supavisor session-mode URL on port 5432 instead."
    ]);
  }

  if (connectionKind === "neon-pooler") {
    fail([
      "DIRECT_URL is using the Neon pooled host, which is not the intended connection for Prisma migrate/status in this repo.",
      `Resolved DIRECT_URL: ${directUrl}`,
      "Use the direct Neon host without the -pooler suffix instead."
    ]);
  }

  if (connectionKind === "supabase-session-pooler") {
    console.warn(
      "Prisma migrate/status is using the Supabase session pooler on port 5432. This is valid, though the direct Postgres URL is preferred when available."
    );
  }

  const result = spawnSync("pnpm", ["exec", "prisma", ...prismaArgs], {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: directUrl,
      DIRECT_URL: directUrl
    },
    stdio: "inherit",
    encoding: "utf8"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
