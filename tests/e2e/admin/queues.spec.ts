import { expect, test } from "@playwright/test";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";

const governedConfirmationLabel =
  "I reviewed balances, timeline, intent state, and release posture before taking a governed action.";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the selected review workspace and pending release-review detail", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/queues");

  await expect(page).toHaveURL(/reviewCase=review_case_1/);
  await expect(page.getByRole("heading", { name: "Selected workspace" })).toBeVisible();
  await expect(page.getByText("review_case_1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Release review detail" })).toBeVisible();
  await expect(page.getByText("Governed release decision required")).toBeVisible();
});

test("records a note and hands the case off to another operator", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/queues");

  await page.getByLabel("Operator note").fill("Evidence reviewed and queued for compliance.");
  const noteRequest = waitForJsonRequest(page, "/review-cases/internal/review_case_1/notes");
  await page.getByRole("button", { name: "Record note" }).click();

  await expectJsonRequest(noteRequest, {
    note: "Evidence reviewed and queued for compliance."
  });
  await expect(page.getByText("Workspace note recorded.")).toBeVisible();
  await expect(page.getByLabel("Operator note")).toHaveValue("");

  await page.getByLabel("Operator note").fill("Controlled handoff to compliance lead.");
  await page.getByLabel("Next operator").fill("ops_compliance_1");
  const handoffRequest = waitForJsonRequest(page, "/review-cases/internal/review_case_1/handoff");
  await page.getByRole("button", { name: "Handoff case" }).click();

  await expectJsonRequest(handoffRequest, {
    nextOperatorId: "ops_compliance_1",
    note: "Controlled handoff to compliance lead."
  });
  await expect(page.getByText("Review case handed off.")).toBeVisible();
  await expect(
    page
      .locator(".admin-detail-item")
      .filter({ has: page.getByText("Assigned operator") })
      .getByText("ops_compliance_1")
  ).toBeVisible();
});

test("requests an account-release review when no pending release decision exists", async ({
  page
}) => {
  await mockAdminApi(
    page,
    buildAdminScenario("happy", {
      releaseReviews: {
        data: {
          reviews: [],
          limit: 20
        }
      }
    })
  );

  await page.goto("/queues");
  await expect(page.getByText("No pending release reviews")).toBeVisible();

  await page.getByLabel("Operator note").fill("Restriction evidence is cleared for governed release.");
  await page.getByLabel(governedConfirmationLabel).check();
  const releaseRequest = waitForJsonRequest(
    page,
    "/review-cases/internal/review_case_1/request-account-release"
  );
  await page.getByRole("button", { name: "Request account release review" }).click();

  await expectJsonRequest(releaseRequest, {
    note: "Restriction evidence is cleared for governed release."
  });
  await expect(page.getByText("Account release review requested.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Release review detail" })).toBeVisible();
});

test("applies manual resolution when the selected review becomes eligible", async ({ page }) => {
  await mockAdminApi(
    page,
    buildAdminScenario("happy", {
      reviewWorkspace: {
        data: {
          reviewCase: {
            id: "review_case_1",
            type: "deposit_review",
            status: "in_progress",
            reasonCode: "kyc_watch",
            notes: null,
            assignedOperatorId: "ops_e2e",
            startedAt: "2026-04-13T07:00:00.000Z",
            resolvedAt: null,
            dismissedAt: null,
            createdAt: "2026-04-13T06:00:00.000Z",
            updatedAt: "2026-04-13T07:00:00.000Z",
            customer: {
              customerId: "customer_1",
              supabaseUserId: "supabase_1",
              email: "amina@example.com",
              firstName: "Amina",
              lastName: "Rahman"
            },
            customerAccountId: "account_1",
            transactionIntent: {
              id: "intent_admin_1",
              intentType: "deposit",
              status: "failed",
              policyDecision: "approved",
              requestedAmount: "1.25",
              settledAmount: null,
              failureCode: "stalled_runtime",
              failureReason: "The managed runtime stalled after policy approval.",
              manuallyResolvedAt: null,
              manualResolutionReasonCode: null,
              manualResolutionNote: null,
              manualResolvedByOperatorId: null,
              manualResolutionOperatorRole: null,
              manualResolutionReviewCaseId: null,
              sourceWalletId: null,
              sourceWalletAddress: null,
              destinationWalletId: "wallet_1",
              destinationWalletAddress: "0x1111222233334444555566667777888899990000",
              externalAddress: null,
              asset: {
                id: "asset_eth",
                symbol: "ETH",
                displayName: "Ether",
                decimals: 18,
                chainId: 1
              },
              latestBlockchainTransaction: null,
              createdAt: "2026-04-13T06:00:00.000Z",
              updatedAt: "2026-04-13T07:00:00.000Z"
            }
          },
          manualResolutionEligibility: {
            eligible: true,
            reasonCode: "allowed",
            reason: "The linked intent is terminal and eligible for governed manual resolution.",
            operatorRole: "operations_admin",
            operatorAuthorized: true,
            allowedOperatorRoles: ["operations_admin"],
            currentIntentStatus: "failed",
            currentReviewCaseStatus: "in_progress",
            currentReviewCaseType: "deposit_review",
            recommendedAction: "apply_manual_resolution"
          },
          caseEvents: [],
          relatedTransactionAuditEvents: [],
          balances: [],
          recentIntents: [],
          recentLimit: 10
        }
      }
    })
  );

  await page.goto("/queues");

  await page.getByLabel("Operator note").fill("Terminal runtime failure confirmed with customer-safe resolution.");
  await page.getByLabel("Manual resolution reason").selectOption("support_case_closed");
  await page.getByLabel(governedConfirmationLabel).check();
  const manualResolutionRequest = waitForJsonRequest(
    page,
    "/review-cases/internal/review_case_1/apply-manual-resolution"
  );
  await page.getByRole("button", { name: "Apply manual resolution" }).click();

  await expectJsonRequest(manualResolutionRequest, {
    manualResolutionReasonCode: "support_case_closed",
    note: "Terminal runtime failure confirmed with customer-safe resolution."
  });
  await expect(page.getByText("Manual resolution applied.")).toBeVisible();
  await expect(
    page.getByText("Manual resolution has already been applied for this review case.")
  ).toBeVisible();
});

test("approves a pending account-release review and preserves the selected detail", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/queues");

  await page.getByLabel("Operator note").fill("Restriction can be lifted after governance review.");
  await page.getByLabel(governedConfirmationLabel).check();
  const approveRequest = waitForJsonRequest(
    page,
    "/review-cases/internal/account-release-requests/review_case_1/decision"
  );
  await page.getByRole("button", { name: "Approve account release" }).click();

  await expectJsonRequest(approveRequest, {
    decision: "approved",
    note: "Restriction can be lifted after governance review."
  });
  await expect(page.getByText("Account release approved.")).toBeVisible();
  await expect(page.getByText("Latest release decision captured")).toBeVisible();
  await expect(
    page
      .locator(".admin-list-card")
      .filter({ has: page.getByRole("heading", { name: "Release review detail" }) })
      .getByText("Restriction can be lifted after governance review.")
      .first()
  ).toBeVisible();
});

test("surfaces release-decision failures without dropping the selected workspace", async ({
  page
}) => {
  await mockAdminApi(page, {
    decideAccountRelease: {
      ok: false,
      statusCode: 500,
      message: "Failed to approve account release."
    }
  });

  await page.goto("/queues");

  await page.getByLabel(governedConfirmationLabel).check();
  await page.getByRole("button", { name: "Approve account release" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to approve account release.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected workspace" })).toBeVisible();
  await expect(page.getByText("review_case_1")).toBeVisible();
});
