import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./test-user";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

/** Milestone 2 must expose no outward action. */
async function expectNoExternalActions(page: Page) {
  for (const name of [/^apply/i, /send/i, /contact (the )?(recruiter|employer)/i, /submit application/i, /email (the )?recruiter/i, /accept offer/i]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
}

test("employer intelligence with clearly marked sample data", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Employers" }).first().click();
  await expect(page.getByText("No employers yet")).toBeVisible();
  await page.getByRole("button", { name: "Load sample data" }).first().click();
  await expect(page.getByText(/SAMPLE data loaded/)).toBeVisible({ timeout: 30_000 });

  const cards = page.getByTestId("employer-card");
  await expect(cards).toHaveCount(8);
  for (const card of await cards.all()) await expect(card.getByText("Sample data")).toBeVisible();
  await expect(page.getByTestId("coverage")).toContainText("8 employers");

  // Filter: confirmed sponsorship only
  await page.getByRole("checkbox", { name: "Confirmed sponsorship" }).check();
  await page.getByRole("button", { name: "Update results" }).click();
  await expect(page).toHaveURL(/sponsorship=confirmed_sponsorship/);
  for (const card of await cards.all()) await expect(card.getByTestId("sponsorship-badge")).toHaveText(/Confirmed sponsorship/);

  // Search + state
  await page.goto("/dashboard/employers?state=TX");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Lone Star Midstream");
  await expect(cards.first().getByTestId("sponsorship-badge")).toHaveText(/Historical evidence only/);

  // Employer profile: explicit no + conflict + evidence with dates
  await page.goto("/dashboard/employers?q=Coastal");
  await page.getByRole("link", { name: "Sample — Coastal Wind Partners" }).click();
  const sponsorship = page.getByTestId("sponsorship-card");
  await expect(sponsorship.getByTestId("sponsorship-badge")).toHaveText(/Explicitly no sponsorship/);
  await expect(sponsorship).toContainText("past filings");
  await expect(page.getByTestId("careers-link")).toHaveAttribute("href", /^https:\/\/example\.com\/sample\//);
  const evidence = page.getByTestId("evidence-item");
  expect(await evidence.count()).toBeGreaterThanOrEqual(2);
  for (const item of await evidence.all()) await expect(item.getByTestId("evidence-retrieved")).not.toHaveText("Not set");
  await expectNoExternalActions(page);

  // Save an employer
  await page.getByRole("button", { name: /^Save Sample — Coastal/ }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/dashboard/employers?saved=1");
  await expect(cards).toHaveCount(1);
});

test("job discovery: ranking, explanation, salary screen, saved jobs", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Jobs" }).first().click();
  const jobs = page.getByTestId("job-card");
  await expect(jobs).toHaveCount(12);

  // Best match first; not-viable roles last
  await expect(jobs.first().getByTestId("match-badge")).toContainText("Strong match");
  await expect(jobs.last().getByTestId("match-badge")).toContainText("Not viable");

  // Salary screen filter
  await page.goto("/dashboard/jobs?salary=within_target");
  for (const card of await jobs.all()) await expect(card).toContainText("Within target");
  await page.goto("/dashboard/jobs?salary=below_target");
  await expect(jobs).toHaveCount(2);

  // Explainable breakdown that sums to the score
  await page.goto("/dashboard/jobs");
  const topTitle = await jobs.first().getByRole("link").first().innerText();
  await jobs.first().getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: topTitle, exact: true })).toBeVisible();
  const breakdown = page.getByTestId("match-breakdown");
  const scoreText = await breakdown.innerText();
  const score = Number(scoreText.match(/Score (\d+)\/100/)![1]);
  let sum = 0;
  for (const key of ["title", "industry", "location", "salary", "sponsorship", "qualifications"]) {
    const t = await page.getByTestId(`component-${key}`).innerText();
    sum += Number(t.match(/(\d+) \/ \d+/)![1]);
  }
  expect(sum).toBe(score);
  await expect(page.getByTestId("job-retrieved")).not.toBeEmpty();
  await expectNoExternalActions(page);

  // Save the job and filter to saved
  await page.getByRole("button", { name: `Save ${topTitle}` }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/dashboard/jobs?saved=1");
  await expect(jobs).toHaveCount(1);
  await expect(jobs.first()).toContainText(topTitle);
});

test("immigration pathways: E-3 currently ineligible, others uncertain and sourced", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Immigration Pathways" }).first().click();
  await page.locator("#citizenships").fill("IN");
  await page.locator("#citizenships").press("Enter");
  await page.getByLabel("Highest degree").selectOption("bachelor");
  await page.getByRole("button", { name: "Save and re-assess" }).click();
  await expect(page.getByText("Immigration profile saved and pathways re-assessed.")).toBeVisible();

  const e3 = page.getByTestId("pathway-e3");
  await expect(e3.getByTestId("eligibility-currently_ineligible")).toBeVisible();
  await expect(e3.getByTestId("pathway-headline")).toHaveText("Currently ineligible — Australian citizenship required");
  await expect(e3).toContainText("subclass 485");
  await expect(e3).toContainText("If you acquire Australian citizenship.");
  await expect(page.getByTestId("pathway-eb2_niw").getByTestId("eligibility-needs_attorney_review")).toBeVisible();
  await expect(page.getByTestId("pathway-h1b")).toContainText("Depends on employer");
  await expect(page.getByTestId("pathway-h1b")).toContainText("not yet verified by this platform");

  // Job pages now show role-specific pathway notes
  await page.goto("/dashboard/jobs");
  await page.getByTestId("job-card").first().getByRole("link").first().click();
  await expect(page.getByTestId("pathway-notes")).toContainText("Currently ineligible — Australian citizenship required");
});

test("data sources, agent activity and removal of sample data", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Data Sources" }).first().click();
  await expect(page.getByTestId("data-sources")).toContainText("Greenhouse Job Board API");
  await expect(page.getByTestId("data-sources")).toContainText("SAMPLE DATA — fictional");
  await expect(page.getByTestId("ref-sources")).toContainText("USCIS");
  await expect(page.getByTestId("agent-runs")).toContainText("job matching");
  await expect(page.getByTestId("agent-runs")).toContainText("immigration intelligence");

  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByTestId("audit-log")).toContainText("Job matches");

  await page.getByRole("link", { name: "Employers" }).first().click();
  await page.getByRole("button", { name: "Remove sample data" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove sample data" }).click();
  await expect(page.getByText("Sample data removed.")).toBeVisible();
  await expect(page.getByText("No employers yet")).toBeVisible();
});
