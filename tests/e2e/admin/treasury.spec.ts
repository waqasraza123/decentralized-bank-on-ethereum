import { expect, test } from "@playwright/test";
import { mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads treasury visibility and lets the operator inspect wallet-specific activity", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/treasury");

  await expect(page.getByText("Coverage posture")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Managed workers" })).toBeVisible();
  await expect(page.getByText("Selected wallet")).toBeVisible();
  await expect(page.getByText("treasury_wallet_1")).toBeVisible();
  await expect(page.getByText("Selected treasury activity")).toBeVisible();
  await expect(page.getByText("intent_treasury_1")).toBeVisible();

  await page.getByText("0x222233...00001111").click();

  await expect(page.getByText("Customer assignment")).toBeVisible();
  await expect(page.getByText("account_1")).toBeVisible();
  await expect(page.getByText("intent_treasury_2")).toBeVisible();
});

test("applies treasury visibility scope through the operator workspace", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/treasury");
  await page.getByLabel("Treasury wallet limit").fill("1");
  await page.getByLabel("Treasury activity limit").fill("1");
  await page.getByLabel("Treasury alert limit").fill("1");
  await page.getByLabel("Treasury stale-after seconds").fill("600");

  const overviewRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === "GET" &&
      url.pathname.endsWith("/treasury/internal/overview") &&
      url.searchParams.get("walletLimit") === "1" &&
      url.searchParams.get("activityLimit") === "1" &&
      url.searchParams.get("alertLimit") === "1" &&
      url.searchParams.get("staleAfterSeconds") === "600"
    );
  });

  await page.getByRole("button", { name: "Apply visibility scope" }).click();
  await overviewRequest;

  await expect(page.getByText("0x333344...11112222")).not.toBeVisible();
  await expect(
    page.getByText("A managed treasury worker is retrying with RPC timeouts.")
  ).not.toBeVisible();
});

test("shows the unavailable state when treasury visibility fails", async ({ page }) => {
  await mockAdminApi(page, {
    treasuryOverview: {
      ok: false,
      statusCode: 500,
      message: "Treasury visibility unavailable."
    }
  });

  await page.goto("/treasury");

  await expect(
    page.getByRole("heading", { name: "Treasury visibility unavailable" })
  ).toBeVisible();
});
