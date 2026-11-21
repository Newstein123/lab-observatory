import { expect, test } from "@playwright/test";

/** The view's tools: move and re-centre, layers, display settings and the snapshot. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "ue.sky.v1",
      // 03:30 in Bangkok: Orion high, no Moon in the way.
      JSON.stringify({ siteId: "bangkok", live: false, manual: { cloud: 0, haze: "light", seeingArcsec: 2 }, timeMode: "fixed", fixedAt: "2026-11-19T20:30:00.000Z" }),
    ),
  );
});

test("drag moves the telescope off the target; Centre puts it back", async ({ page }) => {
  await page.goto("/lab/simulate?target=m42");
  const centre = page.getByRole("button", { name: "Centre the target" });
  await expect(centre).toBeDisabled();
  const view = page.locator("[data-view-canvas]");
  await view.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await expect(centre).toBeEnabled();
  await centre.click();
  await expect(centre).toBeDisabled();
});

test("layers draw a real RA/Dec grid and the compass", async ({ page }) => {
  await page.goto("/lab/simulate?target=m42");
  await page.getByRole("button", { name: "Layers" }).click();
  const layers = page.getByRole("dialog", { name: "Layers" });
  await layers.getByLabel(/^RA\/Dec grid/).check();
  await layers.getByLabel(/^Compass/).check();
  const overlay = page.locator("[data-view-overlay]");
  // M42 is at about RA 5h35m, Dec −5°23′: the grid is labelled around there.
  await expect(overlay.getByText(/^5h3\dm/).first()).toBeAttached();
  await expect(overlay.getByText(/^−5°/).first()).toBeAttached();
  await expect(overlay.getByText("N", { exact: true })).toBeAttached();
});

test("view settings: orientation mirrors the view; seeing off leaves the optics alone", async ({ page }) => {
  await page.goto("/lab/simulate?target=saturn");
  const seeingRow = page.locator("summary").filter({ hasText: /^Effective resolution \(with seeing\)/ });
  await expect(seeingRow).toHaveCount(1);
  await page.getByRole("button", { name: "View settings" }).click();
  await page.getByRole("radio", { name: "Diagonal" }).click();
  await expect(page.locator("[data-view-canvas]")).toHaveCSS("transform", /matrix\(-1, 0, 0, 1/);
  // Without the atmosphere only the optical limit remains: the seeing-limited result goes.
  await page.getByLabel(/^Atmospheric seeing/).uncheck();
  await expect(seeingRow).toHaveCount(0);
});

test("snapshot shows the view with its caption and offers a download", async ({ page }) => {
  await page.goto("/lab/simulate?target=m42");
  await page.getByRole("button", { name: "Snapshot" }).click();
  const dialog = page.getByRole("dialog", { name: "Snapshot" });
  await expect(dialog.getByRole("img", { name: /Snapshot: Orion Nebula/ })).toBeVisible();
  await expect(dialog.getByText(/Bangkok · /)).toBeVisible();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download PNG" }).click();
  expect((await download).suggestedFilename()).toMatch(/^m42-eyepiece-.*\.png$/);
});
