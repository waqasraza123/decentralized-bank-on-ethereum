import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the selected alert workspace and persists alert filters in the URL", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/alerts");

  await expect(page).toHaveURL(/alert=alert_1/);
  await expect(page.getByText("Selected alert")).toBeVisible();
  await expect(page.getByText("Delivery health")).toBeVisible();

  const filteredRequest = page.waitForRequest((request) => {
    if (request.method() !== "GET") {
      return false;
    }

    const url = new URL(request.url());
    return (
      url.pathname.endsWith("/operations/internal/alerts") &&
      url.searchParams.get("severity") === "warning" &&
      url.searchParams.get("category") === "treasury" &&
      url.searchParams.get("routingStatus") === "routed" &&
      url.searchParams.get("acknowledged") === "true" &&
      url.searchParams.get("suppressed") === "true" &&
      url.searchParams.get("ownerOperatorId") === "ops_treasury_1"
    );
  });

  await page.getByLabel("Alert severity filter").selectOption("warning");
  await page.getByLabel("Alert category filter").selectOption("treasury");
  await page.getByLabel("Alert routing filter").selectOption("routed");
  await page.getByLabel("Alert acknowledgement filter").selectOption("true");
  await page.getByLabel("Alert suppression filter").selectOption("true");
  await page.getByLabel("Alert owner filter").fill("ops_treasury_1");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await filteredRequest;
  await expect(page).toHaveURL(/severity=warning/);
  await expect(page).toHaveURL(/category=treasury/);
  await expect(page).toHaveURL(/routingStatus=routed/);
  await expect(page).toHaveURL(/acknowledged=true/);
  await expect(page).toHaveURL(/suppressed=true/);
  await expect(page).toHaveURL(/ownerOperatorId=ops_treasury_1/);
  await expect(page).toHaveURL(/alert=alert_3/);
  await expect(
    page.getByText("Treasury wallet coverage is drifting from the expected baseline.").first()
  ).toBeVisible();
});

test("assigns ownership, acknowledges, suppresses, clears suppression, routes, and retries alert deliveries", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/alerts");

  await page.getByLabel("Alert note").fill("Ownership moved to compliance.");
  await page.getByRole("checkbox").check();
  const assignOwnerRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/assign-owner"
  );
  await page.getByLabel("Alert owner operator").fill("ops_compliance_1");
  await page.getByRole("button", { name: "Assign owner" }).click();
  await expectJsonRequest(assignOwnerRequest, {
    ownerOperatorId: "ops_compliance_1",
    note: "Ownership moved to compliance."
  });
  await expect(page.getByText("Assigned alert owner to ops_compliance_1.")).toBeVisible();
  await expect(page.getByText("ops_compliance_1").first()).toBeVisible();

  await page.getByLabel("Alert note").fill("Acknowledged after triage.");
  await page.getByRole("checkbox").check();
  const acknowledgeRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/acknowledge"
  );
  await page.getByRole("button", { name: "Acknowledge alert" }).click();
  await expectJsonRequest(acknowledgeRequest, {
    note: "Acknowledged after triage."
  });
  await expect(page.getByText("Alert acknowledged.")).toBeVisible();

  await page.getByLabel("Alert note").fill("Temporary suppression during paging maintenance.");
  await page.getByLabel("Alert suppress until").fill("2026-04-14T09:30:00.000Z");
  await page.getByRole("checkbox").check();
  const suppressRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/suppress"
  );
  await page.getByRole("button", { name: "Suppress alert" }).click();
  await expectJsonRequest(suppressRequest, {
    suppressedUntil: "2026-04-14T09:30:00.000Z",
    note: "Temporary suppression during paging maintenance."
  });
  await expect(page.getByText("Alert suppression updated.")).toBeVisible();
  await expect(page.getByText("Suppression is active")).toBeVisible();

  await page.getByLabel("Alert note").fill("Maintenance window ended.");
  await page.getByRole("checkbox").check();
  const clearSuppressionRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/clear-suppression"
  );
  await page.getByRole("button", { name: "Clear suppression" }).click();
  await expectJsonRequest(clearSuppressionRequest, {
    note: "Maintenance window ended."
  });
  await expect(page.getByText("Alert suppression cleared.")).toBeVisible();

  await page.getByLabel("Alert note").fill("Route into the governed alert review queue.");
  await page.getByRole("checkbox").check();
  const routeRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/route-review-case"
  );
  await page.getByRole("button", { name: "Route to review case" }).click();
  await expectJsonRequest(routeRequest, {
    note: "Route into the governed alert review queue."
  });
  await expect(page.getByText("Alert routed to review case.")).toBeVisible();
  await expect(page.getByText("Review routed")).toBeVisible();

  await page.getByLabel("Alert note").fill("Retry failed deliveries after routing.");
  await page.getByRole("checkbox").check();
  const retryRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/retry-deliveries"
  );
  await page.getByRole("button", { name: "Retry deliveries" }).click();
  await expectJsonRequest(retryRequest, {
    note: "Retry failed deliveries after routing."
  });
  await expect(page.getByText("Delivery retry requested.")).toBeVisible();
});

test("routes critical alerts in bulk and reports the remaining backlog", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/alerts");

  await page.getByLabel("Alert note").fill("Bulk route the critical alert backlog.");
  await page.getByLabel("Critical route limit").fill("2");
  await page.getByLabel("Critical route stale after seconds").fill("600");
  await page.getByRole("checkbox").check();

  const routeCriticalRequest = waitForJsonRequest(page, "/operations/internal/alerts/route-critical");
  await page.getByRole("button", { name: "Route critical alerts" }).click();
  await expectJsonRequest(routeCriticalRequest, {
    limit: 2,
    staleAfterSeconds: 600,
    note: "Bulk route the critical alert backlog."
  });

  await expect(page.getByText("Routed 2 critical alerts.")).toBeVisible();
  await expect(page.getByText("2 routed, 0 critical alerts still unrouted.")).toBeVisible();
});

test("shows inline action failures while preserving the selected alert workspace", async ({
  page
}) => {
  await mockAdminApi(page, {
    assignAlertOwner: {
      ok: false,
      statusCode: 500,
      message: "Failed to assign alert owner."
    }
  });

  await page.goto("/alerts");

  await page.getByLabel("Alert owner operator").fill("ops_escalation");
  await page.getByLabel("Alert note").fill("Ownership escalation failed.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Assign owner" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to assign alert owner.")).toBeVisible();
  await expect(page.getByText("Primary delivery target is timing out.").first()).toBeVisible();
  await expect(page.getByText("Selected alert")).toBeVisible();
});

test("keeps controls locked when no alert is selected", async ({ page }) => {
  await mockAdminApi(page, buildAdminScenario("empty"));

  await page.goto("/alerts");

  await expect(page.getByText("No alert selected")).toBeVisible();
});
