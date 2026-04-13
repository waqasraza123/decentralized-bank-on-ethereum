import {
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import {
  defaultReleaseReadinessEnvironmentForProof,
  runReleaseReadinessProof
} from "./release-readiness-proof-runner";

describe("release-readiness-proof-runner", () => {
  it("runs the contract invariant proof using the configured workspace command", async () => {
    const commandExecutor = jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "contract invariant suite passed",
      stderr: "",
      durationMs: 321
    });

    const result = await runReleaseReadinessProof({
      evidenceType: "contract_invariant_suite",
      workspaceRoot: "/tmp/repo",
      commandExecutor
    });

    expect(commandExecutor).toHaveBeenCalledWith(
      "pnpm",
      [
        "--filter",
        "@stealth-trails-bank/contracts",
        "test",
        "--",
        "--grep",
        "invariant"
      ],
      "/tmp/repo",
      undefined
    );
    expect(result.status).toBe("passed");
    expect(result.summary).toContain("Contract invariant suite passed");
    expect(result.runbookPath).toBe(
      "docs/runbooks/release-candidate-verification.md"
    );
    expect(result.evidencePayload).toEqual(
      expect.objectContaining({
        proofKind: "automated_command_bundle",
        durationMs: 321
      })
    );
    expect(result.evidencePayload).toEqual(
      expect.objectContaining({
        commands: [
          expect.objectContaining({
            label: "staking_pool_invariants",
            exitCode: 0,
            status: "passed"
          })
        ]
      })
    );
  });

  it("captures failing output for automated proof execution", async () => {
    const commandExecutor = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "finance flows passed",
        stderr: "",
        durationMs: 111
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "replay recovery failed",
        durationMs: 222
      });

    const result = await runReleaseReadinessProof({
      evidenceType: "end_to_end_finance_flows",
      workspaceRoot: "/tmp/repo",
      commandExecutor
    });

    expect(result.status).toBe("failed");
    expect(result.summary).toContain("End-to-end finance flow suite failed");
    expect(result.evidencePayload).toEqual(
      expect.objectContaining({
        durationMs: 333,
        commands: [
          expect.objectContaining({
            label: "finance_flow_integration",
            status: "passed"
          }),
          expect.objectContaining({
            label: "replay_and_recovery_specs",
            status: "failed",
            stderrTail: "replay recovery failed"
          })
        ]
      })
    );
  });

  it("adds live smoke to staging-like end-to-end proof when live environment is configured", async () => {
    const commandExecutor = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "finance integration passed",
        stderr: "",
        durationMs: 100
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "replay safety passed",
        stderr: "",
        durationMs: 110
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "worker recovery passed",
        stderr: "",
        durationMs: 120
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "live smoke passed",
        stderr: "",
        durationMs: 130
      });

    const result = await runReleaseReadinessProof({
      evidenceType: "end_to_end_finance_flows",
      environment: "production_like",
      workspaceRoot: "/tmp/repo",
      runtimeEnv: {
        PLAYWRIGHT_LIVE_WEB_URL: "https://prodlike-web.example.com",
        PLAYWRIGHT_LIVE_WEB_EMAIL: "operator@example.com",
        PLAYWRIGHT_LIVE_WEB_PASSWORD: "secret",
        PLAYWRIGHT_LIVE_ADMIN_URL: "https://prodlike-admin.example.com",
        PLAYWRIGHT_LIVE_ADMIN_API_BASE_URL: "https://prodlike-api.example.com",
        PLAYWRIGHT_LIVE_ADMIN_OPERATOR_ID: "ops_stage_1",
        PLAYWRIGHT_LIVE_ADMIN_API_KEY: "operator-key"
      },
      commandExecutor
    });

    expect(commandExecutor).toHaveBeenLastCalledWith(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        "--project",
        "live-web-smoke",
        "--project",
        "live-admin-smoke"
      ],
      "/tmp/repo",
      {
        PLAYWRIGHT_INCLUDE_LIVE_SMOKE: "1"
      }
    );
    expect(result.status).toBe("passed");
    expect(result.evidencePayload).toEqual(
      expect.objectContaining({
        durationMs: 460,
        environment: "production_like",
        liveSmokeRequired: true,
        liveSmokeIncluded: true,
        commands: expect.arrayContaining([
          expect.objectContaining({
            label: "live_stack_smoke",
            command:
              "PLAYWRIGHT_INCLUDE_LIVE_SMOKE=1 pnpm exec playwright test --project live-web-smoke --project live-admin-smoke",
            environmentOverrides: ["PLAYWRIGHT_INCLUDE_LIVE_SMOKE"],
            status: "passed"
          })
        ])
      })
    );
  });

  it("fails staging-like end-to-end proof when live smoke environment is missing", async () => {
    const commandExecutor = jest.fn();

    const result = await runReleaseReadinessProof({
      evidenceType: "end_to_end_finance_flows",
      environment: "production_like",
      workspaceRoot: "/tmp/repo",
      runtimeEnv: {
        PLAYWRIGHT_LIVE_WEB_URL: "https://prodlike-web.example.com"
      },
      commandExecutor
    });

    expect(commandExecutor).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(result.summary).toContain(
      "requires live smoke environment variables"
    );
    expect(result.evidencePayload).toEqual(
      expect.objectContaining({
        environment: "production_like",
        liveSmokeRequired: true,
        missingEnvironmentVariables: expect.arrayContaining([
          "PLAYWRIGHT_LIVE_WEB_EMAIL",
          "PLAYWRIGHT_LIVE_ADMIN_API_KEY"
        ])
      })
    );
  });

  it("builds manual review evidence with normalized links and payload", async () => {
    const result = await runReleaseReadinessProof({
      evidenceType: "secret_handling_review",
      status: "passed",
      summary: "  Launch secret rotation reviewed.  ",
      note: "  Rotation ticket SEC-42 attached. ",
      evidenceLinks: [" docs/security/secret-handling-review.md ", "", "ticket/SEC-42"],
      evidencePayload: {
        ticketId: "SEC-42"
      }
    });

    expect(result.status).toBe("passed");
    expect(result.summary).toBe("Launch secret rotation reviewed.");
    expect(result.note).toBe("Rotation ticket SEC-42 attached.");
    expect(result.evidenceLinks).toEqual([
      "docs/security/secret-handling-review.md",
      "ticket/SEC-42"
    ]);
    expect(result.evidencePayload).toEqual(
      expect.objectContaining({
        proofKind: "manual_attestation",
        ticketId: "SEC-42"
      })
    );
  });

  it("defaults automated proofs to development and manual reviews to production-like", () => {
    expect(
      defaultReleaseReadinessEnvironmentForProof(
        "backend_integration_suite"
      )
    ).toBe("development");
    expect(
      defaultReleaseReadinessEnvironmentForProof(
        "role_review"
      )
    ).toBe("production_like");
  });
});
