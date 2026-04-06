// @ts-check
import { test, expect } from "@playwright/test";

test("home shows shell-specific product label and docs entry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "pharos.web",
  );
  await expect(page.getByRole("link", { name: "Documentation" })).toBeVisible();
});

test("docs shell loads and shows primary nav", async ({ page }) => {
  await page.goto("/docs/start");
  await expect(
    page.getByRole("navigation", { name: "Primary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start", exact: true }),
  ).toBeVisible();
});

test("IA hub routes resolve from primary nav (Concepts)", async ({ page }) => {
  await page.goto("/docs/start");
  await page.getByRole("link", { name: "Concepts", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/concepts$/);
  await expect(
    page.locator(".ph-docs-article h1"),
  ).toHaveText("Concept library");
});

/** Deep-link + body: validates reference hub content for integrators (daemon/API alignment). */
test("API reference doc loads from deep link", async ({ page }) => {
  await page.goto("/docs/reference/api-contracts");
  await expect(page.locator(".ph-docs-article h1")).toHaveText("API reference");
  await expect(page.getByText(/OpenAPI|snake_case/)).toBeVisible();
});
