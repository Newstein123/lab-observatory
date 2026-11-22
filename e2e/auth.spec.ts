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

/** Local Supabase captures auth emails in Mailpit. */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function latestLinkTo(email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
        const id = list.messages?.[0]?.ID;
        if (!id) return undefined;
        const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
        link = String(message.Text ?? "").match(/https?:\/\/\S+\/auth\/v1\/verify\?[^\s)\]]+/)?.[0];
        return link;
      },
      { timeout: 20_000 },
    )
    .toBeTruthy();
  return link!.replace(/&amp;/g, "&");
}

test("forgotten password: email a reset link, set a new password, sign in with it", async ({ page, isMobile }) => {
  // One project only: local Supabase allows very few auth emails per hour.
  test.skip(isMobile, "Desktop only (email rate limit)");
  test.skip(!(await fetch(`${MAILPIT}/api/v1/info`).then((r) => r.ok, () => false)), "Mailpit not reachable");

  const email = (await signUpFreshUser(page))!;
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page.locator("form").getByRole("status")).toContainText(/reset link is on its way/);

  await page.goto(await latestLinkTo(email));
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  const NEW_PASSWORD = "a-brand-new-password-42";
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/observatory/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(/invalid/i);
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/observatory/);
});

test("an expired or broken reset link explains itself", async ({ page }) => {
  await page.goto("/auth/reset?error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByRole("alert").filter({ hasText: "Email link is invalid or has expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
});
