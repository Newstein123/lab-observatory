import { expect, test, type Page } from "@playwright/test";

/**
 * Sky, place and conditions: the location/time panel, live weather (mocked,
 * so tests never reach Open-Meteo), the Moon's phase, targets below the
 * horizon, the ideal-conditions toggle and the Tonight planner.
 */

const BASE_PREFS = {
  siteId: "bangkok",
  live: false,
  manual: { cloud: 0, haze: "light", seeingArcsec: 2 },
  timeMode: "fixed",
  // 20:00 in Bangkok: the Moon (41% lit, waxing) is up in the south-west.
  fixedAt: "2026-11-16T13:00:00.000Z",
};

async function withSky(page: Page, prefs: Partial<typeof BASE_PREFS> = {}) {
  await page.addInitScript((p) => window.localStorage.setItem("ue.sky.v1", JSON.stringify(p)), { ...BASE_PREFS, ...prefs });
}

/** Mock both Open-Meteo APIs with 20% cloud and hazy air for 2026-11-15…18. Returns the requested URLs. */
async function mockWeather(page: Page): Promise<string[]> {
  const urls: string[] = [];
  const time = Array.from({ length: 96 }, (_, i) => new Date(Date.UTC(2026, 10, 15) + i * 3_600_000).toISOString().slice(0, 16));
  await page.route("https://api.open-meteo.com/**", (route) => {
    urls.push(route.request().url());
    return route.fulfill({
      json: {
        hourly: {
          time,
          cloud_cover: time.map(() => 20),
          relative_humidity_2m: time.map(() => 70),
          wind_speed_10m: time.map(() => 2),
          wind_speed_250hPa: time.map(() => 25),
        },
      },
    });
  });
  await page.route("https://air-quality-api.open-meteo.com/**", (route) => {
    urls.push(route.request().url());
    return route.fulfill({ json: { hourly: { time, aerosol_optical_depth: time.map(() => 0.42), pm2_5: time.map(() => 35) } } });
  });
  return urls;
}

/** Mean brightness of a rectangle of the view canvas, as fractions of its size. */
async function canvasBrightness(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<number> {
  return page.locator("canvas[aria-label*='view of']").first().evaluate(
    (c: HTMLCanvasElement, [a, b, d, e]) => {
      const ctx = c.getContext("2d")!;
      const { data } = ctx.getImageData(Math.round(a * c.width), Math.round(b * c.height), Math.round((d - a) * c.width), Math.round((e - b) * c.height));
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
      return sum / (data.length / 4) / 3;
    },
    [x0, y0, x1, y1],
  );
}

test("Bangkok with live weather: place, Moon and forecast in the sky panel", async ({ page }) => {
  const urls = await mockWeather(page);
  await withSky(page, { live: true });
  await page.goto("/lab/simulate?target=moon");

  await expect(page.getByRole("region", { name: "Sky and location" }).getByPlaceholder("Bangkok, Thailand")).toBeVisible();
  // The details are in the side panel's Sky tab.
  await page.getByRole("tab", { name: "Sky" }).click();
  const panel = page.getByRole("region", { name: "Sky conditions" });
  await expect(panel.getByLabel(/Light pollution/)).toHaveValue("9");
  await expect(panel.getByText("Waxing crescent · 41%")).toBeVisible();
  await expect(panel.getByText("Cloud 20%")).toBeVisible();
  await expect(panel.getByText("Haze (AOD) 0.42")).toBeVisible();
  // Only coarse coordinates leave the browser.
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(u).toMatch(/latitude=13\.8&longitude=100\.5&/);
});

test("the Moon is drawn at its phase: lit on the sunward side", async ({ page }) => {
  await withSky(page);
  await page.goto("/lab/simulate?target=moon");
  // Waxing in the evening: north up, the lit side faces west (right).
  await expect.poll(async () => (await canvasBrightness(page, 0.53, 0.42, 0.65, 0.58)) - (await canvasBrightness(page, 0.35, 0.42, 0.47, 0.58)), { timeout: 30_000 }).toBeGreaterThan(15);
});

test("a target below the horizon says when it rises, and jumps there", async ({ page }) => {
  // 13:00 in Bangkok: Orion is down.
  await withSky(page, { fixedAt: "2026-11-16T06:00:00.000Z" });
  await page.goto("/lab/simulate?target=m42");
  await expect(page.getByText(/Orion Nebula is below the horizon from Bangkok/)).toBeVisible();
  // The horizon is to blame, not the telescope.
  await expect(page.getByText("Orion Nebula can't be seen right now")).toBeVisible();
  await expect(page.getByText("Orion Nebula is out of reach for this setup")).toHaveCount(0);
  await page.getByRole("button", { name: /^Show it at/ }).click();
  await expect(page.getByText(/is below the horizon/)).toHaveCount(0);
});

test("ideal conditions darken a city sky and show what it costs", async ({ page }) => {
  // 01:00 in Bangkok: Orion high, no Moon.
  await withSky(page, { fixedAt: "2026-11-16T18:00:00.000Z" });
  await page.goto("/lab/simulate?target=m42");
  const edge = () => canvasBrightness(page, 0.12, 0.45, 0.18, 0.55);
  await expect.poll(edge, { timeout: 30_000 }).toBeGreaterThan(25);
  const city = await edge();

  await page.getByRole("switch", { name: "Ideal conditions" }).click();
  await expect(page.getByText("Ideal conditions vs. your sky now")).toBeVisible();
  await expect.poll(edge).toBeLessThan(city - 15);

  await page.getByRole("switch", { name: "Ideal conditions" }).click();
  await expect(page.getByText("Ideal conditions vs. your sky now")).toHaveCount(0);
});

test("Tonight lists what's up from Bangkok, best first", async ({ page }) => {
  await withSky(page, { fixedAt: "2026-11-16T12:00:00.000Z" });
  await page.goto("/lab/tonight");
  const great = page.getByRole("region", { name: "Great tonight" });
  await expect(great).toBeVisible({ timeout: 20_000 });
  await expect(great.getByText("Jupiter", { exact: true })).toBeVisible();
  // Orion is up all night from Bangkok in November: worth looking at, not "not tonight".
  await expect(page.getByRole("region", { name: /^(Great tonight|Possible)$/ }).getByText("Orion Nebula")).toBeVisible();

  await great.getByRole("link", { name: /Simulate at/ }).first().click();
  await expect(page).toHaveURL(/\/lab\/simulate\?target=/);
});
