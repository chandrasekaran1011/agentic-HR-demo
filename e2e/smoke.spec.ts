import { test, expect } from "@playwright/test";

test.describe("Phase 1 smoke", () => {
  test("login redirects unauthenticated users", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login → candidates → detail → admin happy path", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("hr");
    await page.getByLabel("Password").fill("acme2026");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/candidates/);
    await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();
    await expect(page.getByText("Priya Sharma")).toBeVisible();
    await expect(page.getByText("Aanya Patel")).toBeVisible();

    await page.getByRole("link", { name: "Priya Sharma" }).click();
    await expect(page).toHaveURL(/\/candidates\/priya-sharma/);
    await expect(page.getByRole("heading", { name: "Priya Sharma" })).toBeVisible();
    await expect(page.getByText("HRMS")).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    await expect(page.getByText("Total candidates")).toBeVisible();

    await page.goto("/systems/hrms");
    await expect(page.getByRole("heading", { name: "HRMS" })).toBeVisible();
  });

  test("invalid login shakes and shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("hr");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
