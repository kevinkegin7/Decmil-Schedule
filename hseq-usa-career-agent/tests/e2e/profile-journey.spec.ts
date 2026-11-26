import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./test-user";

const HEADLINE = "Senior HSEQ professional — mining, construction and renewables (E2E)";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/dashboard/qualifications");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fqualifications/);
});

test("wrong password is rejected with a generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("profile journey: edit, add, change, sign out, sign in, data persists", async ({ page }) => {
  // 1. User logs in
  await login(page);

  // 2. User opens the dashboard
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByTestId("card-completion")).toBeVisible();
  await expect(page.getByTestId("card-salary")).toContainText("$120,000 – $150,000");
  await expect(page.getByTestId("card-locations")).toContainText("All 50 states");
  await expect(page.getByTestId("card-verified")).toContainText("0 of 0");

  // 3. User edits the professional summary
  await page.getByRole("link", { name: "My Career Profile" }).first().click();
  await page.getByLabel("Full name").fill("E2E Owner");
  await page.getByLabel("Headline summary").fill(HEADLINE);
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // Required-field validation runs before saving
  await page.getByLabel("Full name").fill("");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByText("Full name is required")).toBeVisible();
  await page.getByLabel("Full name").fill("E2E Owner");

  // 4. User adds employment history
  await page.getByRole("link", { name: "Employment History" }).first().click();
  await expect(page.getByText("No employment history yet")).toBeVisible();
  await page.getByRole("button", { name: "Add employment" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Employer").fill("Decmil");
  await dialog.getByLabel("Job title").fill("HSE Advisor");
  await dialog.getByLabel("Industry").selectOption("construction");
  await dialog.getByLabel("Country").fill("Australia");
  await dialog.getByLabel("Start date").fill("2022-02-01");
  await dialog.getByText("This is my current role").click();
  await dialog.getByRole("button", { name: "Add employment" }).click();
  await expect(page.getByText("Employment record added.")).toBeVisible();
  await expect(page.getByTestId("employment-record")).toContainText("HSE Advisor");

  // 5. User adds a qualification (starts unverified)
  await page.getByRole("link", { name: "Qualifications" }).first().click();
  await page.getByRole("button", { name: "Add qualification" }).first().click();
  const qDialog = page.getByRole("dialog");
  await qDialog.getByLabel("Qualification name").fill("E2E Test Certificate in Occupational Health");
  await qDialog.getByLabel("Awarding organisation").fill("E2E Awarding Body");
  await qDialog.getByLabel("Issue date").fill("2020-01-15");
  await qDialog.getByLabel("Expiry date").fill("2019-01-01");
  await qDialog.getByRole("button", { name: "Add qualification" }).click();
  await expect(qDialog.getByText("Expiry date must be after the issue date")).toBeVisible();
  await qDialog.getByLabel("Expiry date").fill("");
  await qDialog.getByRole("button", { name: "Add qualification" }).click();
  await expect(page.getByText(/Qualification added/)).toBeVisible();
  const qCard = page.getByTestId("qualification-record");
  await expect(qCard).toContainText("E2E Test Certificate in Occupational Health");
  await expect(qCard).toContainText("Unverified");

  // 6. User changes salary preferences
  await page.getByRole("link", { name: "Recruitment Preferences" }).first().click();
  await page.getByLabel("Minimum (USD)").fill("200000");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Minimum salary cannot be greater than maximum salary")).toBeVisible();
  await page.getByLabel("Minimum (USD)").fill("125000");
  await page.getByLabel("Maximum (USD)").fill("155000");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Recruitment preferences saved.")).toBeVisible();

  // 7. User logs out
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL("**/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  // 8. User logs back in and the data is still there
  await login(page);
  await expect(page.getByTestId("overview-headline")).toHaveText(HEADLINE);
  await expect(page.getByTestId("card-salary")).toContainText("$125,000 – $155,000");
  await expect(page.getByTestId("overview-history")).toContainText("HSE Advisor · Decmil");
  await expect(page.getByTestId("overview-qualifications")).toContainText("E2E Test Certificate in Occupational Health");
  await expect(page.getByTestId("card-verified")).toContainText("0 of 1");

  await page.getByRole("link", { name: "My Career Profile" }).first().click();
  await expect(page.getByLabel("Headline summary")).toHaveValue(HEADLINE);
  await page.getByRole("link", { name: "Recruitment Preferences" }).first().click();
  await expect(page.getByLabel("Minimum (USD)")).toHaveValue("125000");
  await expect(page.getByLabel("Maximum (USD)")).toHaveValue("155000");

  // The audit log shows what happened
  await page.getByRole("link", { name: "Settings" }).first().click();
  const audit = page.getByTestId("audit-log");
  await expect(audit).toContainText("Signed in");
  await expect(audit).toContainText("Signed out");
  await expect(audit).toContainText("Career preferences updated");
});

test("deleting a record asks for confirmation first", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Employment History" }).first().click();

  // Own fixture: add a past role to delete.
  await page.getByRole("button", { name: "Add employment" }).first().click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Employer").fill("Delete Me Pty Ltd");
  await form.getByLabel("Job title").fill("Safety Officer");
  await form.getByLabel("Start date").fill("2015-01-01");
  await form.getByLabel("End date").fill("2016-01-01");
  await form.getByRole("button", { name: "Add employment" }).click();
  await expect(page.getByText("Employment record added.")).toBeVisible();
  const record = page.getByTestId("employment-record").filter({ hasText: "Delete Me Pty Ltd" });
  await expect(record).toHaveCount(1);

  // Cancel keeps the record.
  await record.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Delete this employment record?");
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(record).toHaveCount(1);

  // Confirm deletes it.
  await record.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Employment record deleted.")).toBeVisible();
  await expect(record).toHaveCount(0);
});
