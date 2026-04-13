import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the governed incident-package workspace with scoped preview data", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/incident-packages");

  await expect(page).toHaveURL(/release=incident_package_release_1/);
  await expect(page.getByText("Scoped customer package")).toBeVisible();
  await expect(page.getByText("Governed export preview")).toBeVisible();
  await expect(page.getByText("Selected release")).toBeVisible();
  await expect(page.getByLabel("Governed incident package export JSON")).toContainText(
    "\"customerAccountId\": \"account_1\""
  );
});

test("applies package scope and creates a governed release request", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/incident-packages");

  await page.getByLabel("Incident package customer account ID").fill("account_9");
  await page.getByLabel("Incident package export mode").selectOption("redaction_ready");
  await page.getByLabel("Incident package recent limit").fill("8");
  await page.getByLabel("Incident package timeline limit").fill("20");
  await page.getByLabel("Incident package since days").fill("14");
  await page.getByRole("button", { name: "Apply package scope" }).click();

  await expect(page.getByLabel("Governed incident package export JSON")).toContainText(
    "\"customerAccountId\": \"account_9\""
  );

  await page
    .getByLabel("Incident package release target")
    .selectOption("external_counsel");
  await page
    .getByLabel("Incident package release reason code")
    .fill("external_legal_review");
  await page
    .getByLabel("Incident package request note")
    .fill("External counsel requested a redaction-ready packet for legal review.");
  await page
    .getByText(
      "I verified the scoped customer account, export mode, and release target before requesting governed release."
    )
    .click();

  const createRequest = waitForJsonRequest(
    page,
    "/customer-account-incident-package/internal/releases"
  );
  await page.getByRole("button", { name: "Create release request" }).click();

  await expectJsonRequest(createRequest, {
    customerAccountId: "account_9",
    mode: "redaction_ready",
    releaseTarget: "external_counsel",
    releaseReasonCode: "external_legal_review",
    requestNote: "External counsel requested a redaction-ready packet for legal review.",
    recentLimit: 8,
    timelineLimit: 20,
    sinceDays: 14
  });

  await expect(page.getByText("Release request created.")).toBeVisible();
  await expect(page).toHaveURL(/release=incident_package_release_3/);
});

test("approves and releases a governed incident-package request", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/incident-packages");

  await page
    .getByLabel("Incident package operator note")
    .fill("Reviewed export contents and approved controlled disclosure.");
  await page
    .getByText(
      "I reviewed the governed export, artifact checksum, and release target before taking action."
    )
    .click();

  const approveRequest = waitForJsonRequest(
    page,
    "/customer-account-incident-package/internal/releases/incident_package_release_1/approve"
  );
  await page.getByRole("button", { name: "Approve request" }).click();
  await expectJsonRequest(approveRequest, {
    approvalNote: "Reviewed export contents and approved controlled disclosure."
  });
  await expect(page.getByText("Release approved.")).toBeVisible();
  await expect(page.getByText("Approval note")).toBeVisible();

  await page
    .getByLabel("Incident package operator note")
    .fill("Released to the compliance case system.");
  await page
    .getByText(
      "I reviewed the governed export, artifact checksum, and release target before taking action."
    )
    .click();

  const releaseRequest = waitForJsonRequest(
    page,
    "/customer-account-incident-package/internal/releases/incident_package_release_1/release"
  );
  await page.getByRole("button", { name: "Release package" }).click();
  await expectJsonRequest(releaseRequest, {
    releaseNote: "Released to the compliance case system."
  });
  await expect(page.getByText("Package released.")).toBeVisible();
  await expect(page.getByText("Package released").last()).toBeVisible();
});

test("rejects a governed request and keeps the selected detail visible", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/incident-packages");

  await page
    .getByLabel("Incident package operator note")
    .fill("The package still needs additional review before disclosure.");
  await page
    .getByText(
      "I reviewed the governed export, artifact checksum, and release target before taking action."
    )
    .click();

  const rejectRequest = waitForJsonRequest(
    page,
    "/customer-account-incident-package/internal/releases/incident_package_release_1/reject"
  );
  await page.getByRole("button", { name: "Reject request" }).click();
  await expectJsonRequest(rejectRequest, {
    rejectionNote: "The package still needs additional review before disclosure."
  });

  await expect(page.getByText("Release rejected.")).toBeVisible();
  await expect(page.getByText("Selected release")).toBeVisible();
  await expect(page.getByText("Rejection note")).toBeVisible();
});

test("surfaces governed action failures without dropping the selected release", async ({
  page
}) => {
  await mockAdminApi(page, {
    approveIncidentPackageRelease: {
      ok: false,
      statusCode: 500,
      message: "Failed to approve incident package release."
    }
  });

  await page.goto("/incident-packages");

  await page
    .getByText(
      "I reviewed the governed export, artifact checksum, and release target before taking action."
    )
    .click();
  await page.getByRole("button", { name: "Approve request" }).click();

  await expect(page.getByText("Governed action failed")).toBeVisible();
  await expect(page.getByText("Failed to approve incident package release.")).toBeVisible();
  await expect(page.getByText("incident_package_release_1")).toBeVisible();
});
