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
