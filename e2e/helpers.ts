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
