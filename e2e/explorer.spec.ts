import { expect, test, type Page } from "@playwright/test";
import { accountsEnabled, signUpFreshUser } from "./helpers";

/**
 * Astronomical Object Explorer: identification in the eyepiece view, the
 * explorer panel and its adaptive tabs, the lunar 3D terrain with honest
 * labelling, and pinning. Time and place are fixed so positions are
 * deterministic.
 */

const PREFS = {
  siteId: "bangkok",
  live: false,
  manual: { cloud: 0, haze: "light", seeingArcsec: 2 },
  timeMode: "fixed",
  // 21:00 in Bangkok: a waxing gibbous Moon high in the sky.
  fixedAt: "2026-11-21T14:00:00.000Z",
};

async function withSky(page: Page, fixedAt = PREFS.fixedAt) {
  await page.addInitScript((p) => window.localStorage.setItem("ue.sky.v1", JSON.stringify(p)), { ...PREFS, fixedAt });
}

const explorer = (page: Page) => page.getByTestId("object-explorer");

test("Moon features are labelled from their coordinates and open the explorer", async ({ page }) => {
  await withSky(page);
  await page.goto("/lab/simulate?target=moon");
  const label = page.locator("[data-feature]").first();
  await expect(label).toBeVisible({ timeout: 30_000 });
  const name = (await label.textContent())!.trim();
  await label.click();
  await expect(explorer(page).getByRole("heading", { name, level: 2 })).toBeVisible();
  // The tabs a surface feature gets.
  for (const tab of ["Object Info", "3D Model", "Surface Map", "Learn"]) await expect(explorer(page).getByRole("tab", { name: tab })).toBeVisible();
  // Closing goes back to the results.
  await explorer(page).getByRole("button", { name: "Close the explorer" }).click();
  await expect(page.getByRole("tab", { name: /Results/ })).toBeVisible();
});

test("Tycho: measured facts, a 3D reconstruction that says so, and pinning that survives a reload", async ({ page }) => {
  await withSky(page);
  await page.goto("/lab/simulate?target=moon&feature=tycho");
  const panel = explorer(page);
  await expect(panel.getByRole("heading", { name: "Tycho", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("Depth (rim to floor)")).toBeVisible();
  await expect(panel.getByText(/≈ 4\.[6-9] km/)).toBeVisible();
  await expect(panel.getByRole("region", { name: "What your telescope shows" })).toBeVisible();

  await panel.getByRole("tab", { name: "3D Model" }).click();
  await expect(panel.getByTestId("terrain-3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText(/Scientific reconstruction from LOLA/)).toBeVisible();
  await expect(panel.getByTestId("exaggeration-badge")).toHaveCount(0);
  await panel.getByLabel("Vertical exaggeration").fill("3");
  await expect(panel.getByTestId("exaggeration-badge")).toHaveText("Elevation exaggerated 3×");

  // The URL pin came in pinned; unpin, pin again, reload.
  const pin = panel.getByRole("button", { name: /^Pinned$|^Pin$/ });
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await pin.click();
  await expect(page).not.toHaveURL(/feature=tycho/);
  await pin.click();
  await expect(page).toHaveURL(/feature=tycho/);
  await page.reload();
  await expect(explorer(page).getByRole("heading", { name: "Tycho", level: 2 })).toBeVisible({ timeout: 30_000 });
});

test("Identify: clicking the view names what is there", async ({ page }) => {
  await withSky(page);
  await page.goto("/lab/simulate?target=moon");
  await expect(page.locator("[data-feature]").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("toolbar", { name: "Observation tools" }).getByRole("button", { name: "Identify" }).click();
  const canvas = page.locator("canvas[aria-label*='view of']").first();
  await canvas.click();
  await expect(explorer(page).getByRole("heading", { level: 2 })).toBeVisible();
});

test("Jupiter's moons are identified by position, never presented as resolved", async ({ page }) => {
  // 04:00 in Bangkok: Jupiter well up in the east.
  await withSky(page, "2026-11-21T21:00:00.000Z");
  await page.goto("/lab/simulate?target=jupiter");
  const moon = page.locator("[data-companion]").first();
  await expect(moon).toBeVisible({ timeout: 30_000 });
  await moon.click();
  const panel = explorer(page);
  await expect(panel.getByText("Identified by position, not resolved")).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Surface Map" })).toHaveCount(0);
  // Its 3D view is the moons' orbits, not a surface.
  await panel.getByRole("tab", { name: "3D Model" }).click();
  await expect(panel.getByRole("tab", { name: "Moons' orbits", selected: true })).toBeVisible();
  await expect(panel.getByTestId("planet-3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
});

test("a nebula: catalogued regions on the real survey image, never a planetary surface map", async ({ page }) => {
  // 01:00 in Bangkok: Orion high.
  await withSky(page, "2026-11-16T18:00:00.000Z");
  await page.goto("/lab/simulate?target=m42");
  const trapezium = page.locator("[data-feature=trapezium]");
  await expect(trapezium).toBeVisible({ timeout: 30_000 });
  await trapezium.click();
  const panel = explorer(page);
  await expect(panel.getByRole("heading", { name: "Trapezium Cluster", level: 2 })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Surface Map" })).toHaveCount(0);
  await expect(panel.getByRole("tab", { name: "3D Model" })).toHaveCount(0);
  await panel.getByRole("tab", { name: "Image" }).click();
  await expect(panel.getByRole("img", { name: /Survey image of Orion Nebula/ })).toBeVisible();
  await expect(panel.getByText(/Real survey photograph/)).toBeVisible();
});

test("Pleiades stars carry catalogue magnitudes and parallax distances", async ({ page }) => {
  await withSky(page, "2026-11-16T18:00:00.000Z");
  await page.goto("/lab/simulate?target=m45&feature=alcyone");
  const panel = explorer(page);
  await expect(panel.getByRole("heading", { name: "Alcyone", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("Magnitude (V)")).toBeVisible();
  await expect(panel.getByText(/light-years/)).toBeVisible();
  await expect(panel.getByText("Visible with this setup")).toBeVisible();
});

test("Saturn: moons placed from JPL-fitted orbits, rings explained with tonight's tilt", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await withSky(page);
  await page.goto("/lab/simulate?target=saturn&feature=cassini-division");
  const panel = explorer(page);
  await expect(panel.getByRole("heading", { name: "Cassini Division", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("Ring opening now")).toBeVisible();
  await expect(panel.getByText("Apparent width at the ring ends")).toBeVisible();
  // Titan is bright enough to be drawn and named.
  await expect(page.locator("[data-companion=titan]")).toBeVisible();
  await panel.getByRole("tab", { name: "3D Model" }).click();
  await expect(panel.getByTestId("planet-3d").locator("canvas")).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText(/ring radii measured, shading illustrative/)).toBeVisible();
  // The orbit view, with its labels, renders cleanly.
  await panel.getByRole("tab", { name: "Moons' orbits" }).click();
  await expect(panel.getByTestId("planet-3d").locator("canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => !/WebGL|GPU stall|GL Driver/i.test(e))).toEqual([]);
});

test("Jupiter: the Great Red Spot's longitude is an estimate, and can be replaced by a measurement", async ({ page }) => {
  await withSky(page, "2026-11-21T21:00:00.000Z");
  await page.goto("/lab/simulate?target=jupiter&feature=great-red-spot");
  const panel = explorer(page);
  await expect(panel.getByRole("heading", { name: "Great Red Spot", level: 2 })).toBeVisible({ timeout: 30_000 });
  const lon = panel.locator("div", { has: page.getByText("System II longitude now", { exact: true }) }).last();
  await expect(lon.getByText("Estimated")).toBeVisible();
  await expect(panel.getByText("Next crosses the central meridian")).toBeVisible();
  await panel.getByRole("button", { name: "Use a measured value" }).click();
  await panel.getByRole("spinbutton").fill("110");
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByText(/Using your measured longitude 110°/)).toBeVisible();
  await expect(lon.getByText("Calculated")).toBeVisible();
  await panel.getByRole("button", { name: "Use a measured value" }).click();
  await panel.getByRole("button", { name: "Back to the model" }).click();
  await expect(panel.getByText(/drift model/).first()).toBeVisible();
});

test("Discoveries: save from the explorer, annotate, reopen and remove", async ({ page }) => {
  const accounts = await accountsEnabled(page);
  if (accounts) await signUpFreshUser(page);
  await withSky(page);
  await page.goto("/lab/simulate?target=moon&feature=tycho");
  const panel = explorer(page);
  await expect(panel.getByRole("heading", { name: "Tycho", level: 2 })).toBeVisible({ timeout: 30_000 });
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  // The toolbar lists it for this target.
  await page.getByRole("toolbar", { name: "Observation tools" }).getByRole("button", { name: /Discoveries/ }).click();
  // Listed under "Saved" (and also under "Recently explored").
  await expect(page.getByRole("dialog", { name: "Your discoveries" }).getByRole("listitem").getByRole("button", { name: /Tycho/ })).toBeVisible();

  await page.goto("/discoveries");
  const card = page.getByTestId("discovery").filter({ hasText: "Tycho" });
  await expect(card).toBeVisible();
  await card.getByLabel("Note for Tycho").fill("Rays reach Mare Nectaris");
  await card.getByRole("button", { name: "Save note" }).click();
  await page.reload();
  await expect(page.getByTestId("discovery").filter({ hasText: "Tycho" }).getByLabel("Note for Tycho")).toHaveValue("Rays reach Mare Nectaris");
  // Related features are suggested; history shows what was explored.
  await expect(page.getByRole("region", { name: "Explore next" }).getByText("Clavius")).toBeVisible();
  await expect(page.getByRole("region", { name: "Recently explored" }).getByRole("link", { name: /Tycho/ })).toBeVisible();

  await page.getByRole("link", { name: "Observe" }).first().click();
  await expect(page).toHaveURL(/target=moon.*feature=tycho/);
  await page.goto("/discoveries");
  await page.getByRole("button", { name: "Remove Tycho" }).click();
  await expect(page.getByText("No discoveries yet")).toBeVisible();
});

test("signed out with accounts enabled, saving asks to sign in", async ({ page }) => {
  test.skip(!(await accountsEnabled(page)), "Browser-only storage: no accounts");
  await withSky(page);
  await page.goto("/lab/simulate?target=moon&feature=tycho");
  await expect(explorer(page).getByRole("link", { name: "Sign in to save" })).toBeVisible({ timeout: 30_000 });
});
