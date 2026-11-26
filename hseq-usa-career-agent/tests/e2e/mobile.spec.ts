import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./test-user";

test("dashboard works on a phone: sign in, navigate by menu, no horizontal scroll", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  await expect(page.getByTestId("card-completion")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Recruitment Preferences" }).click();
  await expect(page.getByRole("heading", { name: "Recruitment Preferences" })).toBeVisible();
  await expect(page.getByLabel("Minimum (USD)")).toBeVisible();
  const prefsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(prefsOverflow).toBeLessThanOrEqual(0);
});
