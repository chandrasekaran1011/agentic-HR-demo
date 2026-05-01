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
    await expect(page).toHaveURL(/\/candidates/);

    // Click Onboard for Karan
    const karanRow = page.getByRole("row", { name: /Karan Shah/ });
    await expect(karanRow).toBeVisible();
    await karanRow.getByRole("button", { name: /Onboard manually/ }).click();

    // Should land on Karan's detail page
    await expect(page).toHaveURL(/\/candidates\/karan-shah/);
    await expect(page.getByRole("heading", { name: "Karan Shah" })).toBeVisible();

    // Wait for all 12 "done" labels (one per tile). The grid renders one tile
    // per system; each "done" string is unique enough.
    await expect(async () => {
      const doneCount = await page.getByText("done", { exact: true }).count();
      expect(doneCount).toBeGreaterThanOrEqual(12);
    }).toPass({ timeout: 30_000 });
  });
});
