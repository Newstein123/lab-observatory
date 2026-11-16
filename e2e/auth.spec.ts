import { expect, test } from "@playwright/test";
import { accountsEnabled, PASSWORD, signUpFreshUser } from "./helpers";

/** Account flows; only meaningful when Supabase is configured. */

test.beforeEach(async ({ page }) => {
  test.skip(!(await accountsEnabled(page)), "Accounts are not enabled in this build");
});

test("signed-out visitors can simulate but must sign in to save or view saved data", async ({ page }) => {
  await page.goto("/lab?target=moon");
  await expect(page.locator("summary").filter({ hasText: /^Magnification/ })).toContainText("40×");
  await expect(page.getByRole("link", { name: "Sign in to save" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save configuration" })).toHaveCount(0);

  await page.goto("/observatory");
  await expect(page.getByText(/Sign in to see your equipment/)).toBeVisible();
});

test("sign in returns to the page that asked for it", async ({ page }) => {
  const email = await signUpFreshUser(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();

  await page.goto("/lab?target=saturn");
  await page.getByRole("link", { name: "Sign in to save" }).click();
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/lab\/simulate\?target=saturn/);
  await expect(page.getByRole("button", { name: "Save configuration" })).toBeVisible();
});

test("wrong password is reported", async ({ page }) => {
  const email = await signUpFreshUser(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Scope to the form: Next.js also renders a hidden role="alert" route announcer.
  await expect(page.locator("form").getByRole("alert")).toContainText(/invalid/i);
});

test("one user cannot open another user's saved session", async ({ browser }) => {
  const alice = await browser.newPage();
  await signUpFreshUser(alice);
  await alice.goto("/lab/simulate?target=jupiter");
  await alice.getByRole("button", { name: "Save simulation" }).click();
  await alice.getByRole("link", { name: "Open it" }).click();
  await expect(alice.getByRole("heading", { name: "Jupiter · Eyepiece" })).toBeVisible();
  const sessionUrl = alice.url();

  const bob = await browser.newPage();
  await signUpFreshUser(bob);
  await bob.goto(sessionUrl);
  await expect(bob.getByText("This simulation does not exist or was deleted.")).toBeVisible();
});
