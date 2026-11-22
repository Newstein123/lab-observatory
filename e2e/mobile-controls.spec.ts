import { expect, test } from "@playwright/test";

/**
 * Phones: the simulate page's floating control panel. Each control opens a
 * sheet over the lower part of the screen, the change shows straight away,
 * and nothing makes the page wider than the screen.
 */

test.skip(({ isMobile }) => !isMobile, "The control panel is for phones and small tablets.");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "ue.sky.v1",
      // 01:30 in Bangkok on 22 Nov 2026: Jupiter well up.
      JSON.stringify({ siteId: "bangkok", live: false, manual: { cloud: 0, haze: "light", seeingArcsec: 2 }, timeMode: "fixed", fixedAt: "2026-11-21T18:30:00.000Z" }),
    ),
  );
});

const pageWidth = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("the eyepiece sheet changes the magnification without leaving the view", async ({ page }) => {
  await page.goto("/lab/simulate?target=jupiter");
  const panel = page.getByRole("toolbar", { name: "Simulation controls" });
  const eyepiece = panel.getByRole("button", { name: /Eyepiece/ });
  await expect(eyepiece).toContainText("40×"); // 1000 mm with the 25 mm eyepiece

  // The desktop controls card is not shown twice on a phone.
  await expect(page.getByRole("region", { name: "View controls" })).toBeHidden();

  await eyepiece.click();
  const sheet = page.getByRole("dialog", { name: "Eyepiece: magnification" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /^Higher/ }).click();
  await expect(eyepiece).not.toContainText("40×");
  await sheet.getByRole("button", { name: /^Higher/ }).click();
  expect(await pageWidth(page)).toBeLessThanOrEqual(0);

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
});

test("Barlow, sky and results open in the same panel; camera view has its own controls", async ({ page }) => {
  await page.goto("/lab/simulate?target=jupiter");
  const panel = page.getByRole("toolbar", { name: "Simulation controls" });

  await panel.getByRole("button", { name: /Barlow/ }).click();
  await page.getByRole("dialog", { name: "Barlow" }).getByRole("button", { name: /2× Barlow/ }).first().click();
  await expect(panel.getByRole("button", { name: /Barlow/ })).toContainText("2×");
  await expect(panel.getByRole("button", { name: /Eyepiece/ })).toContainText("80×");

  await panel.getByRole("button", { name: /Sky/ }).click();
  await expect(page.getByRole("dialog", { name: "Sky, place and time" }).getByRole("switch", { name: "Ideal conditions" })).toBeVisible();

  await panel.getByRole("button", { name: /Results/ }).click();
  await expect(page.getByRole("dialog", { name: "Results" })).toContainText(/Magnification/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: "Camera view" }).click();
  await panel.getByRole("button", { name: /Exposure/ }).click();
  await expect(page.getByRole("dialog", { name: /Exposure, gain/ }).getByLabel("Gain")).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(0);
});
