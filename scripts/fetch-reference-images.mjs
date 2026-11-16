#!/usr/bin/env node
/**
 * Fetch, verify and prepare reference images for the curated targets.
 *
 *   node scripts/fetch-reference-images.mjs
 *
 * Writes images to public/reference/ and their provenance to
 * src/modules/targets/reference-images.json. Re-run to refresh.
 *
 * Two kinds of image:
 *  - "body"  (Moon, planets): a photograph cropped tightly to the body, so the
 *            image width corresponds to the target's catalogued major axis.
 *  - "field" (deep-sky): a sky-survey cutout centred on the target's J2000
 *            coordinates with a known angular size (north up, east left).
 *
 * Licences are checked against an allowlist; anything else aborts the run.
 *
 * Existing entries in the manifest are kept; pass --force to refetch them,
 * or --only=id1,id2 to (re)fetch specific targets.
 */
import { execFile } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "reference");
const MANIFEST = path.join(ROOT, "src", "modules", "targets", "reference-images.json");
const USER_AGENT = "UniversalObservatory-dev/0.1 (reference image fetch script)";
const ALLOWED_LICENSES = new Set(["Public domain", "CC BY 2.0", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 4.0"]);
const BODY_WIDTH_PX = 1000;
const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const run = promisify(execFile);

const BODIES = [
  {
    targetId: "moon",
    commonsTitle: "File:FullMoon2010.jpg",
    notes: [
      "Earth-based photograph through a 235 mm (9.25-inch) Schmidt-Cassegrain telescope.",
      "Shows a full Moon; the real phase on any given night will differ.",
    ],
  },
  {
    targetId: "jupiter",
    commonsTitle: "File:Jupiter_and_its_shrunken_Great_Red_Spot.jpg",
    notes: [
      "Hubble Space Telescope image (2014). Far sharper than any ground-based view; the Lab blurs it to your calculated resolution.",
      "Cloud bands and the Great Red Spot change over time and with Jupiter's rotation.",
    ],
  },
  {
    targetId: "saturn",
    commonsTitle: "File:Saturn_-_HST_2019-06-20.jpg",
    notes: [
      "Hubble Space Telescope image (June 2019), when the rings were tilted widely towards Earth.",
      "The ring opening changes over a 29.5-year cycle: the rings were edge-on in 2025 and appear much narrower in 2026.",
    ],
  },
  {
    targetId: "venus",
    commonsTitle: "File:Venus-real_color.jpg",
    notes: [
      "Spacecraft image showing a full disc. From Earth, Venus always shows a phase: a half disc near greatest elongation, a thin crescent when largest.",
      "Venus's clouds are almost featureless in visible light.",
    ],
  },
  {
    targetId: "mars",
    commonsTitle: "File:Mars_23_aug_2003_hubble.jpg",
    notes: [
      "Hubble Space Telescope image at the very close 2003 opposition. Surface markings and polar caps change with the Martian seasons and rotation.",
    ],
  },
  {
    targetId: "uranus",
    commonsTitle: "File:Uranus2.jpg",
    notes: ["Voyager 2 image (1986). Through an amateur telescope Uranus is a tiny featureless blue-green disc."],
  },
  {
    targetId: "neptune",
    commonsTitle: "File:Neptune_Full.jpg",
    notes: ["Voyager 2 image (1989). Through an amateur telescope Neptune is a tiny blue disc with no visible detail."],
  },
];

/**
 * DSS2 red + blue give a natural-colour composite. For M31 every DSS2 plate
 * has a mosaic defect ~1.3° north-west of the core, so the older single-band
 * DSS1 survey is used instead (greyscale). Survey data is never retouched.
 */
const DSS2 = { red: "DSS2 Red", blue: "DSS2 Blue" };
/**
 * Cutout size ≈ 2.5 × the target's extent, at least 1.5° so it fills
 * low-power eyepiece fields, at most 5°. At 2048 px a 1.5° cutout has
 * ~2.6″ pixels, close to the survey's own resolution.
 */
const field = (targetId, raDeg, decDeg, majorArcmin, surveys = DSS2) => {
  const sizeDeg = Math.round(Math.min(5, Math.max(1.5, (2.5 * majorArcmin) / 60)) * 100) / 100;
  return { targetId, raDeg, decDeg, sizeDeg, pixels: 2048, surveys };
};
const FIELDS = [
  { targetId: "m42", raDeg: 83.8221, decDeg: -5.3911, sizeDeg: 4, pixels: 2048, surveys: DSS2 },
  { targetId: "m31", raDeg: 10.6847, decDeg: 41.2687, sizeDeg: 5, pixels: 2048, surveys: { mono: "DSS" } },
  field("m33", 23.4621, 30.6602, 70),
  field("m51", 202.4696, 47.1952, 11.2),
  field("m81", 148.8882, 69.0653, 26.9),
  field("m82", 148.9697, 69.6797, 11.2),
  field("m101", 210.8025, 54.3488, 28.8),
  field("m104", 189.9977, -11.6231, 8.7),
  field("m64", 194.1821, 21.6827, 10.7),
  field("ngc253", 11.888, -25.2883, 27.5),
  field("m8", 270.904, -24.387, 90),
  field("m20", 270.596, -23.03, 28),
  field("m17", 275.108, -16.177, 20),
  field("m1", 83.6331, 22.0145, 7),
  field("m57", 283.3962, 33.0292, 1.4),
  field("m27", 299.9016, 22.7212, 8),
  field("ngc7293", 337.4108, -20.8372, 16),
  // The Pleiades' blue reflection nebula saturates the blue plate while the red plate shows
  // little, which the defect check would mistake for a plate defect; the one real strip in
  // this field lies ~2° from the cluster, outside normal eyepiece fields.
  { ...field("m45", 56.85, 24.1167, 110), defectCheck: false },
  field("m44", 130.1, 19.6667, 95),
  field("double-cluster", 35.16, 57.13, 60),
  field("m11", 282.7708, -6.27, 14),
  field("m13", 250.4235, 36.4613, 20),
  field("m22", 279.0998, -23.9048, 32),
];

/** Download via curl (Wikimedia refuses Node's built-in fetch). */
async function fetchBuffer(url) {
  const { stdout } = await run("curl", ["-sSfL", "--retry", "3", "--max-time", "180", "-A", USER_AGENT, String(url)], {
    encoding: "buffer",
    maxBuffer: 300 * 1024 * 1024,
  });
  return stdout;
}

const stripHtml = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function commonsInfo(title) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    // A cached rendition is plenty (bodies are resized to 1000 px) and is not rate-limited like originals.
    iiurlwidth: "1600",
    titles: title,
  }).toString();
  const json = JSON.parse((await fetchBuffer(api)).toString("utf8"));
  const page = Object.values(json.query.pages)[0];
  if (!page.imageinfo) throw new Error(`Commons file not found: ${title}`);
  const ii = page.imageinfo[0];
  const m = ii.extmetadata;
  const license = stripHtml(m.LicenseShortName?.value);
  if (!ALLOWED_LICENSES.has(license)) throw new Error(`${title}: licence "${license}" is not in the allowlist`);
  return {
    url: ii.thumburl ?? ii.url,
    pageUrl: ii.descriptionurl,
    license,
    licenseUrl: stripHtml(m.LicenseUrl?.value) || undefined,
    credit: stripHtml(m.Artist?.value),
    description: stripHtml(m.ImageDescription?.value).slice(0, 300),
  };
}

async function prepareBody(spec) {
  const info = await commonsInfo(spec.commonsTitle);
  const original = await fetchBuffer(info.url);
  // Crop to the body: trim the dark background, then scale to a fixed width.
  const trimmed = await sharp(original).trim({ background: "#000000", threshold: 40 }).toBuffer({ resolveWithObject: true });
  const file = `${spec.targetId}.webp`;
  const out = await sharp(trimmed.data)
    .resize({ width: BODY_WIDTH_PX })
    .webp({ quality: 88 })
    .toFile(path.join(OUT_DIR, file));
  console.log(`✓ ${spec.targetId}: ${info.license}, cropped ${trimmed.info.width}×${trimmed.info.height} → ${out.width}×${out.height}`);
  return {
    targetId: spec.targetId,
    kind: "body",
    src: `/reference/${file}`,
    widthPx: out.width,
    heightPx: out.height,
    source: {
      name: "Wikimedia Commons",
      pageUrl: info.pageUrl,
      credit: info.credit,
      license: info.license,
      licenseUrl: info.licenseUrl,
      description: info.description,
      retrievedAt: new Date().toISOString(),
    },
    processing: "Cropped to the body's extent and resized; colours unchanged.",
    notes: spec.notes,
  };
}

async function skyview(survey, spec) {
  const url = new URL("https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl");
  url.search = new URLSearchParams({
    Survey: survey,
    Position: `${spec.raDeg},${spec.decDeg}`,
    Coordinates: "J2000",
    Projection: "Tan",
    Size: String(spec.sizeDeg),
    Pixels: String(spec.pixels),
    Scaling: "Log",
    Return: "JPEG",
  }).toString();
  const buf = await fetchBuffer(url);
  return { url: url.toString(), raw: await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true }) };
}

/**
 * Display stretch: the median (≈ sky background) maps to black and the
 * 99.95th percentile to white. Monotonic, so no structure is added or removed.
 */
function stretch(data) {
  const sorted = Uint8Array.from(data).sort();
  const black = sorted[Math.floor(sorted.length * 0.5)];
  const white = Math.max(black + 1, sorted[Math.floor(sorted.length * 0.9995)]);
  // Sky background maps to black so the image blends into the dark field.
  const SKY = 0;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = Math.min(1, Math.max(0, (data[i] - black) / (white - black)));
    out[i] = Math.round((SKY + (1 - SKY) * v) * 255);
  }
  return out;
}

/**
 * Plate gaps and defects: areas where a plate has no data (raw value ≈ 0),
 * or where one plate is near-saturated while the other shows only sky. Real sky is
 * never exactly 0 after SkyView's log scaling, but single dark pixels can be,
 * so only pixels in a 15 px window that is mostly zeros count, grown by the
 * window half-width plus a margin.
 */
function plateGaps(plateData, width, height, checkDefects = true) {
  const W = 15;
  const half = W >> 1;
  const zero = new Uint8Array(width * height);
  // ≤ 3 rather than 0: JPEG compression leaves small values in empty areas.
  for (const d of plateData) for (let i = 0; i < width * height; i++) if (d[i] <= 3) zero[i] = 1;
  // Plate defects: one plate saturated or far above its sky level while the other is at (or below) its sky.
  // A real source bright enough to nearly saturate one plate always registers on the other.
  if (plateData.length === 2 && checkDefects) {
    const sky = plateData.map((d) => Uint8Array.from(d).sort()[d.length >> 1]);
    const [a, b] = plateData;
    for (let i = 0; i < width * height; i++) {
      const da = a[i] - sky[0];
      const db = b[i] - sky[1];
      const hotA = a[i] >= 230 || da > 150;
      const hotB = b[i] >= 230 || db > 150;
      if ((hotA && db < 10) || (hotB && da < 10)) zero[i] = 1;
    }
  }
  const sat = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += zero[y * width + x];
      sat[(y + 1) * (width + 1) + x + 1] = sat[y * (width + 1) + x + 1] + row;
    }
  }
  const count = (x0, y0, x1, y1) => sat[y1 * (width + 1) + x1] - sat[y0 * (width + 1) + x1] - sat[y1 * (width + 1) + x0] + sat[y0 * (width + 1) + x0];
  const core = new Uint8Array(width * height);
  let any = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half), y0 = Math.max(0, y - half);
      const x1 = Math.min(width, x + half + 1), y1 = Math.min(height, y + half + 1);
      if (count(x0, y0, x1, y1) > 0.6 * (x1 - x0) * (y1 - y0)) {
        core[y * width + x] = 1;
        any = true;
      }
    }
  if (!any) return core;
  const grow = half + 4;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (core[y * width + x])
        for (let dy = -grow; dy <= grow; dy++)
          for (let dx = -grow; dx <= grow; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < width && yy < height) out[yy * width + xx] = 1;
          }
  return out;
}

/**
 * Gain for the blue plate so that typical stars come out neutral: the median
 * blue/red ratio over bright, unsaturated pixels in the top 2 % of
 * brightness (mostly star images). Clamped so genuinely red nebulae stay red.
 */
function starColourBalance(r, b) {
  const lum = new Uint8Array(r.length);
  for (let i = 0; i < r.length; i++) lum[i] = (r[i] + b[i]) >> 1;
  const sorted = Uint8Array.from(lum).sort();
  const lo = sorted[Math.floor(sorted.length * 0.98)];
  const ratios = [];
  for (let i = 0; i < r.length; i++) if (lum[i] >= lo && r[i] < 245 && b[i] < 245 && r[i] > 30 && b[i] > 5) ratios.push(b[i] / r[i]);
  if (ratios.length < 100) return 1;
  ratios.sort((x, y) => x - y);
  const ratio = ratios[ratios.length >> 1];
  return Math.min(2.5, Math.max(0.6, 1 / ratio));
}

async function prepareField(spec) {
  const emptyFraction = (p) => {
    let z = 0;
    for (const v of p.raw.data) if (v <= 3) z++;
    return z / p.raw.data.length;
  };
  let plates;
  if (spec.surveys.mono) {
    plates = [await skyview(spec.surveys.mono, spec)];
  } else {
    const red = await skyview(spec.surveys.red, spec);
    let blue = await skyview(spec.surveys.blue, spec);
    // Some fields have no usable plate in a survey (mostly zeros): try the older blue survey,
    // otherwise show the red plate alone in greyscale.
    if (emptyFraction(blue) > 0.5) {
      console.log(`  ${spec.targetId}: ${spec.surveys.blue} has no data here; trying DSS1 Blue`);
      blue = await skyview("DSS1 Blue", spec);
      if (emptyFraction(blue) > 0.5) {
        console.log(`  ${spec.targetId}: no blue plate; using ${spec.surveys.red} alone`);
        spec.surveys = { mono: spec.surveys.red };
        blue = undefined;
      } else {
        spec.surveys = { red: spec.surveys.red, blue: "DSS1 Blue" };
      }
    }
    plates = blue ? [red, blue] : [red];
  }
  const { width, height } = plates[0].raw.info;
  const gap = plateGaps(plates.map((p) => p.raw.data), width, height, spec.defectCheck !== false);
  const [r, b] = plates.map((p) => stretch(p.raw.data));
  const blueGain = b ? starColourBalance(r, b) : 1;
  // Natural-colour approximation: R = red plate, B = blue plate (balanced on stars), G = their mean.
  const rgb = Buffer.alloc(width * height * 3);
  let gapPixels = 0;
  for (let i = 0; i < width * height; i++) {
    if (gap[i]) {
      gapPixels++;
      continue; // no data: leave as black sky
    }
    const blue = b ? Math.min(255, Math.round(b[i] * blueGain)) : r[i];
    rgb[i * 3] = r[i];
    rgb[i * 3 + 1] = (r[i] + blue) >> 1;
    rgb[i * 3 + 2] = blue;
  }
  if (gapPixels) console.log(`  ${spec.targetId}: ${gapPixels} px with no plate data set to sky`);
  spec.balance = { blueGain, gapPixels };
  const file = `${spec.targetId}.webp`;
  await sharp(rgb, { raw: { width, height, channels: 3 } }).webp({ quality: 82 }).toFile(path.join(OUT_DIR, file));
  const surveyNames = Object.values(spec.surveys).join(" + ");
  console.log(`✓ ${spec.targetId}: ${surveyNames}, ${width}×${height}, ${spec.sizeDeg}° field`);
  return {
    targetId: spec.targetId,
    kind: "field",
    src: `/reference/${file}`,
    widthPx: width,
    heightPx: height,
    fieldWidthArcsec: spec.sizeDeg * 3600,
    fieldHeightArcsec: spec.sizeDeg * 3600,
    center: { raDeg: spec.raDeg, decDeg: spec.decDeg },
    source: {
      name: "NASA SkyView (Goddard Space Flight Center)",
      pageUrl: "https://skyview.gsfc.nasa.gov/",
      queryUrls: plates.map((p) => p.url),
      credit:
        "Digitized Sky Survey, produced at the Space Telescope Science Institute under U.S. Government grant NAG W-2166; retrieved via NASA SkyView.",
      license: "Free for research and education with acknowledgement",
      licenseUrl: "https://archive.stsci.edu/dss/acknowledging.html",
      description: `${surveyNames} photographic survey, ${spec.sizeDeg}° × ${spec.sizeDeg}° gnomonic cutout centred on the target.`,
      retrievedAt: new Date().toISOString(),
    },
    processing: spec.surveys.mono
      ? "Single photographic band shown in greyscale; log scale with a black-point stretch. North up, east left."
      : `Colour composite: red plate → red, blue plate → blue (×${spec.balance.blueGain.toFixed(2)} so typical stars are neutral), their mean → green; log scale with a black-point stretch. North up, east left.${spec.balance.gapPixels ? " Areas with no plate data are shown as black sky." : ""}`,
    notes: [
      "Long-exposure photographic survey: shows far more colour and faint structure than the eye sees through an eyepiece.",
    ],
  };
}

await mkdir(OUT_DIR, { recursive: true });
let existing = [];
try {
  existing = JSON.parse(await readFile(MANIFEST, "utf8")).images;
} catch {
  // first run
}
const wanted = (id) => (ONLY ? ONLY.includes(id) : FORCE || !existing.some((e) => e.targetId === id));
const images = existing.filter((e) => !wanted(e.targetId));
const failures = [];
for (const spec of [...BODIES.map((b) => ({ ...b, kind: "body" })), ...FIELDS.map((f) => ({ ...f, kind: "field" }))]) {
  if (!wanted(spec.targetId)) continue;
  try {
    images.push(spec.kind === "body" ? await prepareBody(spec) : await prepareField(spec));
  } catch (e) {
    failures.push(spec.targetId);
    console.error(`✗ ${spec.targetId}: ${e.message}`);
  }
}
const order = [...BODIES, ...FIELDS].map((s) => s.targetId);
images.sort((a, b) => order.indexOf(a.targetId) - order.indexOf(b.targetId));
await writeFile(MANIFEST, `${JSON.stringify({ generatedBy: "scripts/fetch-reference-images.mjs", images }, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, MANIFEST)} (${images.length} images)${failures.length ? `; failed: ${failures.join(", ")}` : ""}`);
