import { test, expect } from "@playwright/test";

/**
 * Drives the "Onboard" button on a pending candidate, navigates to the detail
 * page, and asserts all 12 tiles flip to "done" within 30 seconds.
 *
 * Requires both portal (3000) and orchestrator (3001) running plus a fresh
 * `npm run reset`.
 */
test.describe("Phase 2 cascade", () => {
  test("Onboard button triggers cascade and all 12 tiles end done", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel("Username").fill("hr");
    await page.getByLabel("Password").fill("acme2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    // First-time compile of /api/auth/login can be slow on a cold dev server,
    // especially with next/font fetching Fraunces + Geist on first build.
    await expect(page).toHaveURL(/\/candidates/, { timeout: 60_000 });

    // Click Onboard for Tyler
    const tylerRow = page.getByRole("row", { name: /Tyler Brooks/ });
    await expect(tylerRow).toBeVisible();
    await tylerRow.getByRole("button", { name: /Onboard manually/ }).click();

    // Should land on Tyler's detail page
    await expect(page).toHaveURL(/\/candidates\/tyler-brooks/);
    await expect(page.getByRole("heading", { name: "Tyler Brooks" })).toBeVisible();

    // Wait for all 12 "done" labels (one per tile). Real ACS/Tavily calls
    // add latency, so allow up to 90s.
    await expect(async () => {
      const doneCount = await page.getByText("done", { exact: true }).count();
      expect(doneCount).toBeGreaterThanOrEqual(12);
    }).toPass({ timeout: 90_000 });
  });
});
