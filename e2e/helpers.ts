import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery-staple";

/** True when the app under test has accounts enabled (Supabase configured). */
export async function accountsEnabled(page: Page): Promise<boolean> {
  await page.goto("/sign-in");
  return (await page.getByText("Accounts are not enabled").count()) === 0;
}

/**
 * Sign up a brand-new user so every test starts with empty, isolated data.
 * No-op when the app runs with browser-only storage.
 */
export async function signUpFreshUser(page: Page): Promise<string | undefined> {
  if (!(await accountsEnabled(page))) return undefined;
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/observatory/);
  return email;
}

/** A group of configuration fields (Telescope, Eyepiece…), opening "Edit values" first if it is collapsed. */
export async function fieldGroup(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: /^Edit values/ });
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  return page.getByRole("group", { name, exact: true });
}

/**
 * Fix the observing time and place so what is "up" never depends on when the
 * tests run. 01:30 in Bangkok on 22 Nov 2026: Jupiter, Saturn and the Moon are
 * all at least 20° up.
 */
export async function pinSky(page: Page, fixedAt = "2026-11-21T18:30:00.000Z") {
  await page.addInitScript(
    (p) => window.localStorage.setItem("ue.sky.v1", JSON.stringify(p)),
    { siteId: "bangkok", live: false, manual: { cloud: 0, haze: "light", seeingArcsec: 2 }, timeMode: "fixed", fixedAt },
  );
}
