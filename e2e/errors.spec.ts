import { expect, test } from "@playwright/test";

test("an unknown address shows a helpful 404 with a way back", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
  await page.getByRole("link", { name: "Telescope Lab" }).last().click();
  await expect(page).toHaveURL(/\/lab$/);
});
