import { loadWorkerRuntime } from "../src/runtime/worker-runtime";

export const maxDuration = 10;

export async function GET(): Promise<Response> {
  try {
    const runtime = loadWorkerRuntime();

    return Response.json({
      ok: true,
      service: "stealth-trails-bank-worker",
      workerId: runtime.workerId,
      environment: runtime.environment,
      executionMode: runtime.executionMode,
      batchLimit: runtime.batchLimit,
      requestTimeoutMs: runtime.requestTimeoutMs,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Worker runtime unavailable.",
      },
      { status: 500 },
    );
  }
}
