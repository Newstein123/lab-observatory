import { expect, test } from "@playwright/test";

/**
 * Phones: the Lab's "next step" action stays in reach without scrolling the
 * whole page, and the long filter panel does not push the telescopes down.
 */
test("phones: pick a telescope and move through the steps without hunting for the button", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone layout");
  await page.goto("/lab/new");

  // Filters are folded away until asked for.
  await expect(page.getByLabel("Manufacturer")).toBeHidden();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByLabel("Manufacturer")).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();

  await page.getByRole("region", { name: "Telescopes" }).getByRole("listitem").first().getByRole("button").click();
  const bar = page.getByRole("region", { name: "Selected telescope actions" });
  await expect(bar).toBeInViewport();
  await bar.getByRole("button", { name: "Configure →" }).click();
  await expect(page).toHaveURL(/\/lab\/configure/);

  // Step 2: Simulate is reachable from anywhere on the page.
  await page.mouse.wheel(0, 3000);
  const next = page.getByRole("region", { name: "Next step" });
  await expect(next).toBeInViewport();
  await next.getByRole("link", { name: "Simulate →" }).click();
  await expect(page).toHaveURL(/\/lab\/simulate/);
});
