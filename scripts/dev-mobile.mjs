#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const apiEnvPath = path.join(repoRoot, "apps", "api", ".env");

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

function readApiPort() {
  const envFile = parseEnvFile(apiEnvPath);
  const rawPort = process.env.API_PORT ?? envFile.API_PORT ?? "9101";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid API_PORT value: ${rawPort}`);
  }

  return port;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port
    });

    const finalize = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.once("connect", () => finalize(true));
    socket.once("error", () => finalize(false));
    socket.setTimeout(500, () => finalize(false));
  });
}

async function main() {
  const apiPort = readApiPort();
  const apiBaseUrl = `http://localhost:${apiPort}`;
  const childEnv = {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl
  };

  let apiProcess = null;

  if (!(await isPortOpen(apiPort))) {
    console.log(`Starting local API on ${apiBaseUrl} for mobile dev...`);
    apiProcess = spawn("pnpm", ["--filter", "@stealth-trails-bank/api", "dev"], {
      cwd: repoRoot,
      env: childEnv,
      stdio: "inherit"
    });
  } else {
    console.log(`Using existing local API on ${apiBaseUrl}.`);
  }

  const mobileProcess = spawn("pnpm", ["--filter", "@stealth-trails-bank/mobile", "dev"], {
    cwd: repoRoot,
    env: childEnv,
    stdio: "inherit"
  });

  const shutdown = (signal) => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill(signal);
    }

    if (!mobileProcess.killed) {
      mobileProcess.kill(signal);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  mobileProcess.on("exit", (code, signal) => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill("SIGTERM");
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  if (apiProcess) {
    apiProcess.on("exit", (code, signal) => {
      if (mobileProcess.killed) {
        return;
      }

      if (signal || code === 0) {
        return;
      }

      console.error(`Local API exited early with code ${code}.`);
      mobileProcess.kill("SIGTERM");
      process.exit(code ?? 1);
    });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
