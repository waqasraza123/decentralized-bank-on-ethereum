import { expect, test } from "@playwright/test";
import { mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("filters the audit workspace and preserves selected event detail", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/audit");

  await expect(page.getByText("Selected event")).toBeVisible();
  await expect(page.getByText("audit_event_1")).toBeVisible();

  await page.getByLabel("Audit actor type").fill("operator");
  await page
    .getByLabel("Audit action")
    .fill("customer_account.incident_package_release_approved");
  await page
    .getByLabel("Audit target type")
    .fill("CustomerAccountIncidentPackageRelease");

  const auditRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === "GET" &&
      url.pathname.endsWith("/audit-events/internal") &&
      url.searchParams.get("actorType") === "operator" &&
      url.searchParams.get("action") ===
        "customer_account.incident_package_release_approved" &&
      url.searchParams.get("targetType") === "CustomerAccountIncidentPackageRelease"
    );
  });

  await page.getByRole("button", { name: "Apply filters" }).click();
  await auditRequest;

  await expect(page.getByText("Applied filter summary")).toBeVisible();
  await expect(page.getByText("incident_package_release_1")).toBeVisible();
  await expect(page.getByLabel("Selected audit event metadata")).toContainText(
    "\"releaseTarget\": \"compliance_handoff\""
  );
});

test("renders the empty audit state for unmatched filters and can clear back to the full slice", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/audit");
  await page.getByLabel("Audit search").fill("does-not-exist");
  const filteredAuditRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === "GET" &&
      url.pathname.endsWith("/audit-events/internal") &&
      url.searchParams.get("search") === "does-not-exist"
    );
  });

  await page.getByRole("button", { name: "Apply filters" }).click();
  await filteredAuditRequest;

  await expect(page.getByRole("status").filter({ hasText: "No audit events matched" })).toBeVisible();

  const clearedAuditRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === "GET" &&
      url.pathname.endsWith("/audit-events/internal") &&
      !url.searchParams.get("search")
    );
  });
  await page.getByRole("button", { name: "Clear filters" }).click();
  await clearedAuditRequest;
  await expect(page.getByText("audit_event_1")).toBeVisible();
});

test("shows the unavailable state when audit history cannot be loaded", async ({
  page
}) => {
  await mockAdminApi(page, {
    auditEvents: {
      ok: false,
      statusCode: 500,
      message: "Audit trail unavailable."
    }
  });

  await page.goto("/audit");

  await expect(page.getByRole("heading", { name: "Audit trail unavailable" })).toBeVisible();
});
