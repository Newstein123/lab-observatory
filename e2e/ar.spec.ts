import { expect, test } from "@playwright/test";

/**
 * AR: the button exports the current setup as a 3D model and offers AR. Test
 * browsers have no AR, so this checks the model is built and shown, and the
 * fallbacks (QR code on desktop, explanation on phones) appear.
 */

test("AR button shows the setup as a 3D model", async ({ page }, info) => {
  await page.goto("/lab/simulate");
  await page.getByRole("button", { name: "View in augmented reality (AR)" }).first().click();

  if (info.project.name === "mobile") {
    // Touch devices go straight to the full-screen AR page.
    await expect(page).toHaveURL(/\/ar\?.*t=skywatcher-explorer-200p/);
    await expect(page.getByRole("heading", { name: "My 200 mm Newtonian" })).toBeVisible();
  } else {
    const dialog = page.getByRole("dialog", { name: "View in AR" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: /QR code/ })).toBeVisible({ timeout: 15_000 });
  }
  // The exported model loads into the viewer.
  await expect
    .poll(() => page.evaluate(() => (document.querySelector("model-viewer") as (HTMLElement & { loaded?: boolean }) | null)?.loaded ?? false), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect(page.getByText(/m tall at true size/)).toBeVisible();
});

test("an AR link opens the setup it describes, and a broken one explains itself", async ({ page }) => {
  await page.goto("/ar?n=Club%20scope&t=orion-xt8&m=mount-dob-base&e=tv-panoptic-24");
  await expect(page.getByRole("heading", { name: "Club scope" })).toBeVisible();
  await expect(page.getByText(/Orion SkyQuest XT8 · 203 mm f\/5\.9/)).toBeVisible();

  await page.goto("/ar?t=not-a-telescope");
  await expect(page.getByText("This AR link doesn't describe a telescope")).toBeVisible();
});
