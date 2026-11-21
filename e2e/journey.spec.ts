import { expect, test, type Page } from "@playwright/test";
import { signUpFreshUser } from "./helpers";

/**
 * The complete workflow from the UI brief: open the Lab, choose a telescope,
 * configure equipment, pick a target, simulate, compare, save, then review
 * everything in My Observatory.
 */

const metric = (page: Page, name: RegExp) => page.locator("summary").filter({ hasText: name }).first();

test("full journey: Lab → configure → simulate → compare → save → My Observatory", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signUpFreshUser(page);

  // 1. Open Telescope Lab.
  await page.goto("/lab");
  await expect(page.getByRole("heading", { name: "Telescope Lab", level: 1 })).toBeVisible();

  // 2. Choose a telescope from the catalogue.
  await page.getByRole("link", { name: /Choose a telescope/ }).click();
  await expect(page).toHaveURL(/\/lab\/new/);
  await page.getByLabel("Search telescopes").fill("8SE");
  await page.getByRole("button", { name: /NexStar 8SE/ }).click();
  await page.getByRole("button", { name: "Configure this telescope →" }).click();

  // 3. Configure its equipment.
  await expect(page).toHaveURL(/\/lab\/configure/);
  await expect(page.getByRole("region", { name: "Telescope details" })).toContainText("Celestron NexStar 8SE");
  await page.getByRole("navigation", { name: "Equipment categories" }).getByRole("button", { name: "Eyepiece" }).click();
  await page.getByRole("button", { name: /Tele Vue Panoptic 24 mm/ }).click();
  await expect(page.getByRole("region", { name: "eyepiece details" })).toContainText("68°");
  await page.getByRole("navigation", { name: "Equipment categories" }).getByRole("button", { name: "Camera" }).click();
  await page.getByRole("button", { name: /ZWO ASI585MC/ }).click();
  await expect(page.getByRole("region", { name: "Compatibility" })).toBeVisible();

  // 4–5. Select a target and simulate.
  await page.getByRole("link", { name: "Simulate →" }).click();
  await expect(page).toHaveURL(/\/lab\/simulate/);
  await page.getByRole("button", { name: "Saturn" }).click();
  await expect(metric(page, /^Magnification/)).toContainText("85×"); // 2032 / 24
  await page.getByRole("tab", { name: "Camera view" }).click();
  await expect(metric(page, /^Image scale/)).toContainText("0.29″/px"); // 206.265 × 2.9 / 2032

  // 7. Save the configuration and the simulation.
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText(/Saved · v1/)).toBeVisible();
  await page.getByRole("button", { name: "Save simulation" }).click();
  await expect(page.getByText("Simulation saved.")).toBeVisible();

  // 6. Compare against a second configuration and save that one too.
  await page.getByRole("link", { name: "Compare →" }).click();
  await expect(page).toHaveURL(/\/lab\/compare/);
  const comparison = page.getByRole("region", { name: "Comparison" });
  await expect(comparison.getByText("Image scale")).toBeVisible();
  await page.getByRole("button", { name: /^Configuration B: .*Change/ }).click();
  await page.getByLabel("Search equipment").fill("Evostar 80ED");
  await page.getByRole("dialog", { name: "Choose configuration b" }).getByRole("button", { name: /^Sky-Watcher Evostar 80ED/ }).click();
  await expect(comparison.getByRole("row", { name: /Aperture/ })).toContainText("203 mm");
  await expect(comparison.getByRole("row", { name: /Aperture/ })).toContainText("80 mm");
  await page.getByRole("button", { name: "Save configuration B" }).click();
  await expect(page.getByText(/Saved “My Evostar 80ED” to My Observatory/)).toBeVisible();

  // 8–9. Review everything in My Observatory.
  await page.getByRole("link", { name: "My Observatory", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/observatory$/);
  await expect(page.getByRole("link", { name: /Configurations/ }).filter({ hasText: "2" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Simulations/ }).filter({ hasText: "1" })).toBeVisible();

  await page.goto("/observatory/configurations");
  await expect(page.getByRole("heading", { name: "My NexStar 8SE" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Evostar 80ED" })).toBeVisible();

  // Organise the simulation in a project.
  await page.goto("/observatory/projects");
  await page.getByRole("listitem").filter({ hasText: "Solar System Observation" }).getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Solar System Observation" })).toBeVisible();
  await page.getByLabel("Add a saved simulation").selectOption({ index: 1 });
  await expect(page.getByRole("link", { name: "Saturn · Camera" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Targets" }).getByRole("listitem").filter({ hasText: "Saturn" })).toContainText("1 simulation");

  // The saved simulation reopens unchanged.
  await page.getByRole("link", { name: "Saturn · Camera" }).click();
  await expect(page.getByText(/Reproducible/)).toBeVisible();
  await expect(metric(page, /^Image scale/)).toContainText("0.29″/px");
});
