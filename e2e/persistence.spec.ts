import { expect, test, type Page } from "@playwright/test";
import { fieldGroup, signUpFreshUser } from "./helpers";

/**
 * End-to-end coverage for equipment, configurations and sessions
 * (acceptance criteria AC-01 – AC-04, AC-07, AC-08, AC-11).
 * Each test gets a fresh browser context, so storage starts empty.
 */

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signUpFreshUser(page);
});

const metric = (page: Page, name: RegExp) => page.locator("summary").filter({ hasText: name }).first();
const toolbarState = (page: Page) => page.getByText(/^(Not saved|Unsaved changes|Saved · v\d+)/);

async function addTelescope(page: Page) {
  await page.goto("/observatory/equipment");
  await page.getByRole("button", { name: "Add telescope" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add telescope" });
  await dialog.getByLabel("Name", { exact: true }).fill("My 200 mm Newtonian");
  await dialog.getByLabel(/Aperture/).fill("200");
  await dialog.getByLabel(/Focal length/).fill("1000");
  await dialog.getByRole("button", { name: "Add telescope" }).click();
  await expect(page.getByRole("heading", { name: "My 200 mm Newtonian" })).toBeVisible();
}

test("AC-01: create, edit and delete a telescope profile", async ({ page }) => {
  await addTelescope(page);
  await expect(page.getByText("Reflector / Newtonian · 200 mm · 1000 mm · f/5.0")).toBeVisible();
  await expect(page.getByText("Owned", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit telescope" });
  await dialog.getByLabel("Name", { exact: true }).fill("Backyard Dob");
  await dialog.getByLabel("Status").selectOption("planned");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Backyard Dob" })).toBeVisible();
  await expect(page.getByText("Planned", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No telescopes yet")).toBeVisible();
});

test("AC-01: rejects invalid profile values", async ({ page }) => {
  await page.goto("/observatory/equipment");
  await page.getByRole("button", { name: "Add telescope" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add telescope" });
  await dialog.getByLabel(/Aperture/).fill("0");
  await dialog.getByRole("button", { name: "Add telescope" }).click();
  await expect(dialog.getByText("Name is required")).toBeVisible();
  await expect(dialog.getByText("Must be at least 10")).toBeVisible();
});

test("accessories: add an eyepiece from the catalogue and see it in the configurator", async ({ page }) => {
  await page.goto("/observatory/equipment?tab=accessories");
  await page.getByRole("button", { name: "Add accessory" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add accessory" });
  await dialog.getByLabel("Fill from catalogue (optional)").selectOption({ label: "Tele Vue Panoptic 24 mm" });
  await dialog.getByLabel("Name", { exact: true }).fill("My Panoptic");
  await dialog.getByRole("button", { name: "Add accessory" }).click();
  await expect(page.getByRole("heading", { name: "My Panoptic" })).toBeVisible();
  await expect(page.getByText("24 mm · 68° · 1.25″")).toBeVisible();

  await page.goto("/lab/configure?category=eyepiece");
  await page.getByRole("button", { name: /24 mm.*My Panoptic/ }).click();
  await expect(page.getByRole("region", { name: "eyepiece details" }).getByText("68°")).toBeVisible();
});

test("AC-02/AC-04: multiple configurations from one profile; edit, duplicate and relabel", async ({ page }) => {
  await addTelescope(page);
  await page.getByRole("button", { name: "New configuration" }).click();
  await expect(page).toHaveURL(/\/lab\/configure/);
  await expect(toolbarState(page)).toHaveText(/Not saved/);
  // Optics are locked to the profile.
  await expect(page.getByRole("region", { name: "Telescope details" }).getByLabel(/Aperture/)).toBeDisabled();

  await page.getByRole("link", { name: "Simulate →" }).click();
  await expect(page).toHaveURL(/\/lab\/simulate/);
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(toolbarState(page)).toHaveText(/Saved · v1/);
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled();
  await expect((await fieldGroup(page, "Telescope")).getByLabel(/Aperture/)).toBeDisabled();

  // Edit → unsaved → save as v2.
  await (await fieldGroup(page, "Eyepiece")).getByLabel(/Focal length/).fill("10");
  await expect(toolbarState(page)).toHaveText(/Unsaved changes/);
  await expect(metric(page, /^Magnification/)).toContainText("100×");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toolbarState(page)).toHaveText(/Saved · v2/);

  // Second configuration from the same profile.
  await (await fieldGroup(page, "Eyepiece")).getByLabel(/Focal length/).fill("32");
  await page.getByRole("button", { name: "Save as new" }).click();
  await expect(page.getByText(/Saved as a new configuration/)).toBeVisible();

  await page.goto("/observatory/configurations");
  await expect(page.getByText("Equipment: My 200 mm Newtonian")).toHaveCount(2);

  // Duplicate and relabel.
  const first = page.getByRole("listitem").filter({ hasText: "(variant)" });
  await first.getByRole("button", { name: "Duplicate" }).click();
  const copy = page.getByRole("listitem").filter({ hasText: "(variant) (copy)" });
  await expect(copy).toBeVisible();
  await copy.getByLabel("Status").selectOption("planned");
  await expect(copy.getByText("Planned", { exact: true }).first()).toBeVisible();
  await expect(copy.getByText(/v2 ·/)).toBeVisible();
});

test("AC-03: save a hypothetical configuration without a profile", async ({ page }) => {
  await page.goto("/lab/simulate");
  await expect(page.getByText(/Hypothetical \(not linked to your equipment\)/)).toBeVisible();
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(toolbarState(page)).toHaveText(/Saved · v1/);
  await expect(page).toHaveURL(/config=/);

  await page.goto("/observatory/configurations");
  await expect(page.getByText("Hypothetical telescope")).toBeVisible();
});

test("AC-07/AC-08: mode switch keeps target and setup; inputs update results", async ({ page }) => {
  await page.goto("/lab/simulate?target=jupiter");
  await expect(metric(page, /^Magnification/)).toContainText("40×");
  await (await fieldGroup(page, "Eyepiece")).getByLabel(/Focal length/).fill("10");
  await expect(metric(page, /^Magnification/)).toContainText("100×");

  await page.getByRole("tab", { name: "Camera view" }).click();
  await expect(metric(page, /^Image scale/)).toContainText("0.78″/px");
  await expect(page.getByRole("button", { name: "Jupiter" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: "Eyepiece view" }).click();
  await expect(metric(page, /^Magnification/)).toContainText("100×");
});

test("unsaved edits survive moving between Lab steps and reloading", async ({ page }) => {
  await page.goto("/lab/simulate?target=moon");
  await (await fieldGroup(page, "Eyepiece")).getByLabel(/Focal length/).fill("10");
  await expect(metric(page, /^Magnification/)).toContainText("100×");
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await expect(page).toHaveURL(/\/lab\/configure/);
  await page.reload();
  await page.getByRole("link", { name: "Simulate →" }).click();
  await expect(metric(page, /^Magnification/)).toContainText("100×");
});

test("AC-11: a saved session reopens unchanged after the configuration is edited", async ({ page }) => {
  await page.goto("/lab/simulate?target=saturn");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(toolbarState(page)).toHaveText(/Saved · v1/);

  await page.getByRole("button", { name: "Save simulation" }).click();
  await page.getByRole("link", { name: "Open it" }).click();
  await expect(page.getByRole("heading", { name: "Saturn · Eyepiece" })).toBeVisible();
  await expect(page.getByText(/Reproducible/)).toBeVisible();
  await expect(metric(page, /^Magnification/)).toContainText("40×");
  const sessionUrl = page.url();

  // Edit and save the original configuration.
  await page.getByRole("link", { name: /saved configuration v1/ }).click();
  await expect(toolbarState(page)).toHaveText(/Saved · v1/);
  await (await fieldGroup(page, "Eyepiece")).getByLabel(/Focal length/).fill("6");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toolbarState(page)).toHaveText(/Saved · v2/);

  // The session still shows its frozen snapshot.
  await page.goto(sessionUrl);
  await expect(metric(page, /^Magnification/)).toContainText("40×");
  await expect(page.getByText("25 mm, 50°")).toBeVisible();

  await page.goto("/observatory/simulations");
  await expect(page.getByRole("link", { name: "Saturn · Eyepiece", exact: true })).toBeVisible();
});

test("invalid input shows a field error and keeps the last valid result", async ({ page }) => {
  await page.goto("/lab/simulate");
  await (await fieldGroup(page, "Telescope")).getByLabel(/Aperture/).fill("0");
  await expect(page.getByText("Must be at least 10").first()).toBeVisible();
  await expect(page.getByText("Inputs invalid — showing last valid result")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save configuration" })).toBeDisabled();
});
