import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the incident workspace, customer timeline, and can start the incident", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/accounts");

  await expect(page).toHaveURL(/incident=incident_1/);
  await expect(page.getByText("Incident workspace")).toBeVisible();
  await expect(page.getByText("Customer account investigation summary")).toBeVisible();
  await expect(page.getByText("Customer account operations timeline")).toBeVisible();
  await expect(
    page
      .locator(".admin-detail-item")
      .filter({ hasText: "Incident reference" })
      .getByText("incident_1")
  ).toBeVisible();
  await expect(
    page
      .locator(".admin-detail-item")
      .filter({ hasText: "Customer email" })
      .getByText("amina@example.com")
  ).toBeVisible();

  const requestPromise = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/start"
  );
  await page.getByRole("button", { name: "Start incident" }).click();
  await expectJsonRequest(requestPromise, {});
  await expect(page.getByText("Oversight incident started.")).toBeVisible();
});

test("records notes and applies a governed account hold", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/accounts");
  await page.getByLabel("Oversight note").fill("Restriction evidence verified.");

  const noteRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/notes"
  );
  await page.getByRole("button", { name: "Record note" }).click();
  await expectJsonRequest(noteRequest, {
    note: "Restriction evidence verified."
  });
  await expect(page.getByText("Oversight note recorded.")).toBeVisible();
  await expect(page.getByText("Restriction evidence verified.").first()).toBeVisible();

  await page
    .getByText("I reviewed the incident timeline, related cases, and current restriction state.")
    .click();
  await page.getByLabel("Restriction reason").selectOption("manual_review_hold");
  await page.getByLabel("Oversight note").fill("Hold maintained after operator review.");

  const holdRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/place-account-hold"
  );
  await page.getByRole("button", { name: "Apply account hold" }).click();
  await expectJsonRequest(holdRequest, {
    restrictionReasonCode: "manual_review_hold"
  });
  await expect(page.getByText("Account hold applied.")).toBeVisible();
  await expect(page.getByText("Hold maintained after operator review.").first()).toBeVisible();
});

test("resolves and dismisses incidents through governed controls", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/accounts");
  await page
    .getByText("I reviewed the incident timeline, related cases, and current restriction state.")
    .click();

  const resolveRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/resolve"
  );
  await page.getByRole("button", { name: "Resolve incident" }).click();
  await expectJsonRequest(resolveRequest, {});
  await expect(page.getByText("Oversight incident resolved.")).toBeVisible();

  await page.getByRole("checkbox").check();
  const dismissRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/dismiss"
  );
  await page.getByRole("button", { name: "Dismiss incident" }).click();
  await expectJsonRequest(dismissRequest, {});
  await expect(page.getByText("Oversight incident dismissed.")).toBeVisible();
});

test("applies persistent customer timeline filters against the unified account chronology", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/accounts");

  await page.getByLabel("Timeline event type").fill("account_hold.applied");
  await page.getByLabel("Timeline actor ID").fill("ops_e2e");
  await Promise.all([
    page.waitForRequest((request) => {
      if (request.method() !== "GET") {
        return false;
      }

      const url = new URL(request.url());

      return (
        url.pathname.endsWith("/customer-account-operations/internal/timeline") &&
        url.searchParams.get("eventType") === "account_hold.applied" &&
        url.searchParams.get("actorId") === "ops_e2e"
      );
    }),
    page.getByRole("button", { name: "Apply timeline filters" }).click()
  ]);

  await expect(page).toHaveURL(/timelineEventType=account_hold\.applied/);
  await expect(page).toHaveURL(/timelineActorId=ops_e2e/);
  await expect(page.getByText("Restriction evidence verified.").first()).toBeVisible();
  await expect(
    page.getByText("Withdrawal evidence reviewed before manual resolution.")
  ).not.toBeVisible();
});

test("shows inline action errors while preserving incident context", async ({ page }) => {
  await mockAdminApi(page, {
    applyAccountRestriction: {
      ok: false,
      statusCode: 500,
      message: "Failed to apply account restriction."
    }
  });

  await page.goto("/accounts");
  await page
    .getByText("I reviewed the incident timeline, related cases, and current restriction state.")
    .click();
  await page.getByRole("button", { name: "Apply account hold" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to apply account restriction.")).toBeVisible();
  await expect(
    page
      .locator(".admin-detail-item")
      .filter({ hasText: "Incident reference" })
      .getByText("incident_1")
  ).toBeVisible();
});

test("keeps the incident workspace usable when the customer timeline is unavailable", async ({
  page
}) => {
  await mockAdminApi(page, {
    customerAccountTimeline: {
      ok: false,
      statusCode: 500,
      message: "Customer account timeline unavailable."
    }
  });

  await page.goto("/accounts");

  await expect(
    page.getByRole("heading", { name: "Customer account timeline unavailable" })
  ).toBeVisible();
  await expect(
    page
      .locator(".admin-detail-item")
      .filter({ hasText: "Incident reference" })
      .getByText("incident_1")
  ).toBeVisible();

  const requestPromise = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/start"
  );
  await page.getByRole("button", { name: "Start incident" }).click();
  await expectJsonRequest(requestPromise, {});
  await expect(page.getByText("Oversight incident started.")).toBeVisible();
});

test("renders the empty active-hold state", async ({ page }) => {
  await mockAdminApi(page, buildAdminScenario("empty"));

  await page.goto("/accounts");

  await expect(page.getByText("No active account holds")).toBeVisible();
});
