#!/usr/bin/env node
/**
 * Star fields for the eyepiece view, from real catalogues.
 *
 *   node scripts/fetch-star-fields.mjs [--only=m27,m45]
 *
 * For every deep-sky target with a survey image (see reference-images.json):
 *  1. Stars from three catalogues via VizieR (CfA mirror):
 *       Hipparcos (I/239)  V < 7    within 2.5°   (the brightest stars)
 *       Tycho-2   (I/259)  V ≲ 12   within 2.5°
 *       Gaia DR3  (I/355)  G 11.5–15 within 0.6°  (fainter stars near the target)
 *     Each star is stored as its offset from the target (gnomonic, arcsec),
 *     V magnitude and an effective temperature estimated from its colour.
 *     → public/stars/<id>.json
 *     (--reuse rebuilds step 2 from these files without querying.)
 *  2. An "object" image with stars removed (catalogue stars masked, then a
 *     median filter for the many fainter stars on the plates), so the
 *     eyepiece view can draw the stars from the catalogue instead.
 *     → public/reference/<id>-object.webp
 * Updates src/modules/targets/reference-images.json (objectSrc) and writes
 * src/modules/targets/star-fields.json (availability and credits).
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF_MANIFEST = path.join(ROOT, "src", "modules", "targets", "reference-images.json");
const STAR_MANIFEST = path.join(ROOT, "src", "modules", "targets", "star-fields.json");
const STAR_DIR = path.join(ROOT, "public", "stars");
const REF_DIR = path.join(ROOT, "public");
const VIZIER = "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv";
const USER_AGENT = "UniversalObservatory-dev/0.1 (star field fetch script)";
const BRIGHT_RADIUS_DEG = 2.5;
const FAINT_RADIUS_DEG = 0.6;
const FAINT_LIMIT = 15;
const TYCHO_LIMIT = 11.5;
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
/** Rebuild star-free images from already downloaded star data (no catalogue queries). */
const REUSE = process.argv.includes("--reuse");
const run = promisify(execFile);
const RAD = Math.PI / 180;
const ARCSEC_PER_RAD = 206264.806;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One VizieR query. The response must contain the requested columns;
 * otherwise (server busy, error page) it is retried with backoff.
 * `expectRows` guards against silently accepting an empty answer.
 */
async function vizier(params, { expectRows = false } = {}) {
  const url = `${VIZIER}?${new URLSearchParams({ "-out.max": "unlimited", ...params })}`;
  const wanted = params["-out"].split(",");
  for (let attempt = 1; ; attempt++) {
    try {
      const { stdout } = await run("curl", ["-sSf", "--max-time", "280", "-A", USER_AGENT, url], { maxBuffer: 200 * 1024 * 1024 });
      // TSV: comment lines (#), header, units, dashes, then rows.
      const lines = stdout.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      const header = (lines[0] ?? "").split("\t").map((h) => h.trim());
      if (!wanted.every((w) => header.includes(w))) throw new Error("unexpected response (no table header)");
      const rows = lines.slice(3).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [header[i], v.trim()])));
      if (expectRows && rows.length === 0) throw new Error("empty result where stars are certain");
      return { url, rows };
    } catch (e) {
      if (attempt >= 5) throw new Error(`${params["-source"]}: ${e.message}`);
      await sleep(10_000 * 2 ** (attempt - 1));
    }
  }
}

const num = (v) => (v === undefined || v === "" ? undefined : Number(v));

/** Ballesteros (2012): temperature from B−V. */
const teffFromBV = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
/** Mucciarelli & Bellazzini (2020) dwarf relation, clamped: temperature from Gaia BP−RP. */
function teffFromBpRp(x) {
  const c = Math.min(3.5, Math.max(-0.4, x));
  return 5040 / (0.4929 + 0.5092 * c - 0.0353 * c * c);
}
/** Riello et al. (2021): G − V as a function of BP−RP. */
const gMinusV = (x) => -0.02704 + 0.01424 * x - 0.2156 * x * x + 0.01426 * x * x * x;

/** Gnomonic projection: standard coordinates (ξ east, η north) in arcsec. */
function project(ra0, dec0, ra, dec) {
  const a = (ra - ra0) * RAD;
  const d0 = dec0 * RAD;
  const d = dec * RAD;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a);
  return {
    xi: ((Math.cos(d) * Math.sin(a)) / cosc) * ARCSEC_PER_RAD,
    eta: ((Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a)) / cosc) * ARCSEC_PER_RAD,
  };
}

const clampT = (t) => Math.round(Math.min(30000, Math.max(2400, t)));

async function starsFor({ raDeg, decDeg }) {
  const c = `${raDeg.toFixed(5)}${decDeg >= 0 ? "+" : ""}${decDeg.toFixed(5)}`;
  // One at a time, to be gentle with the service. A 2.5° field always holds
  // Tycho-2 stars and a 0.6° field always holds Gaia stars to G = 15.
  const hip = await vizier({ "-source": "I/239/hip_main", "-c": c, "-c.rd": String(BRIGHT_RADIUS_DEG), "-out": "RAICRS,DEICRS,Vmag,B-V", Vmag: "<7" });
  const tyc = await vizier({ "-source": "I/259/tyc2", "-c": c, "-c.rd": String(BRIGHT_RADIUS_DEG), "-out": "RAmdeg,DEmdeg,BTmag,VTmag" }, { expectRows: true });
  const gaia = await vizier(
    { "-source": "I/355/gaiadr3", "-c": c, "-c.rd": String(FAINT_RADIUS_DEG), "-out": "RA_ICRS,DE_ICRS,Gmag,BP-RP", Gmag: `${TYCHO_LIMIT}..${FAINT_LIMIT}` },
    { expectRows: true },
  );

  const stars = [];
  const add = (ra, dec, v, teff, src) => {
    if (![ra, dec, v].every(Number.isFinite)) return;
    const { xi, eta } = project(raDeg, decDeg, ra, dec);
    stars.push({ xi, eta, v, teff, src });
  };
  for (const r of hip.rows) add(num(r.RAICRS), num(r.DEICRS), num(r.Vmag), num(r["B-V"]) !== undefined ? clampT(teffFromBV(num(r["B-V"]))) : 0, "hip");
  for (const r of tyc.rows) {
    const bt = num(r.BTmag);
    const vt = num(r.VTmag);
    if (vt === undefined) continue;
    const v = bt !== undefined ? vt - 0.09 * (bt - vt) : vt;
    if (v > 12) continue;
    add(num(r.RAmdeg), num(r.DEmdeg), v, bt !== undefined ? clampT(teffFromBV(0.85 * (bt - vt))) : 0, "tyc");
  }
  for (const r of gaia.rows) {
    const g = num(r.Gmag);
    const x = num(r["BP-RP"]);
    const v = x !== undefined && x > -0.5 && x < 2.75 ? g - gMinusV(x) : g;
    add(num(r.RA_ICRS), num(r.DE_ICRS), v, x !== undefined ? clampT(teffFromBpRp(x)) : 0, "gaia");
  }

  // Remove duplicates across catalogues: keep the first (Hipparcos, then Tycho-2, then Gaia).
  const kept = [];
  const grid = new Map();
  const cell = (s) => `${Math.floor(s.xi / 20)},${Math.floor(s.eta / 20)}`;
  for (const s of stars) {
    const [cx, cy] = cell(s).split(",").map(Number);
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx++)
      for (let dy = -1; dy <= 1 && !dup; dy++)
        for (const o of grid.get(`${cx + dx},${cy + dy}`) ?? [])
          if (Math.hypot(o.xi - s.xi, o.eta - s.eta) < (s.src === "gaia" ? 3 : 8) && Math.abs(o.v - s.v) < 1.2) dup = true;
    if (dup) continue;
    kept.push(s);
    const k = cell(s);
    grid.set(k, [...(grid.get(k) ?? []), s]);
  }
  kept.sort((a, b) => a.v - b.v);
  return {
    stars: kept,
    queries: [hip.url, tyc.url, gaia.url],
    counts: { hipparcos: hip.rows.length, tycho2: tyc.rows.length, gaia: gaia.rows.length, kept: kept.length },
  };
}

/** Replace a disc around each catalogue star with the median of a surrounding ring. */
function maskStars(data, width, height, stars, arcsecPerPx) {
  const cx = width / 2;
  const cy = height / 2;
  for (const s of stars) {
    const x = cx - s.xi / arcsecPerPx; // east left
    const y = cy - s.eta / arcsecPerPx; // north up
    // Photographic star images grow with brightness (halos); mask generously.
    const rArcsec = Math.min(220, Math.max(6, 6 + 15 * (12 - s.v)));
    const r = Math.max(2, rArcsec / arcsecPerPx);
    if (x < -r || y < -r || x > width + r || y > height + r) continue;
    const ring = [[], [], []];
    const r2 = r * 1.6;
    for (let yy = Math.floor(y - r2); yy <= y + r2; yy++)
      for (let xx = Math.floor(x - r2); xx <= x + r2; xx++) {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const d = Math.hypot(xx - x, yy - y);
        if (d > r && d <= r2) for (let c = 0; c < 3; c++) ring[c].push(data[(yy * width + xx) * 3 + c]);
      }
    const med = ring.map((v) => (v.length ? v.sort((a, b) => a - b)[v.length >> 1] : 0));
    for (let yy = Math.floor(y - r); yy <= y + r; yy++)
      for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        if (Math.hypot(xx - x, yy - y) <= r) for (let c = 0; c < 3; c++) data[(yy * width + xx) * 3 + c] = med[c];
      }
  }
}

/** Previously downloaded stars for a target, in the same shape starsFor() returns. */
async function readCachedStars(targetId) {
  try {
    const data = JSON.parse(await readFile(path.join(STAR_DIR, `${targetId}.json`), "utf8"));
    const stars = [];
    for (let i = 0; i + 3 < data.stars.length; i += 4) stars.push({ xi: data.stars[i], eta: data.stars[i + 1], v: data.stars[i + 2] / 100, teff: data.stars[i + 3] * 10 });
    return { stars, queries: undefined, counts: { kept: stars.length } };
  } catch {
    return undefined;
  }
}

async function processTarget(entry) {
  const { targetId, center } = entry;
  const cached = REUSE ? await readCachedStars(targetId) : undefined;
  const { stars, queries, counts } = cached ?? (await starsFor(center));
  await writeFile(
    path.join(STAR_DIR, `${targetId}.json`),
    JSON.stringify({
      targetId,
      center,
      brightRadiusArcsec: BRIGHT_RADIUS_DEG * 3600,
      faintRadiusArcsec: FAINT_RADIUS_DEG * 3600,
      brightLimitMag: TYCHO_LIMIT,
      faintLimitMag: FAINT_LIMIT,
      // Flat array: ξ arcsec (east +), η arcsec (north +), V × 100, Teff / 10 (0 = unknown).
      stars: stars.flatMap((s) => [Math.round(s.xi * 10) / 10, Math.round(s.eta * 10) / 10, Math.round(s.v * 100), Math.round(s.teff / 10)]),
    }),
  );

  const file = path.join(REF_DIR, entry.src);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const arcsecPerPx = entry.fieldWidthArcsec / info.width;
  maskStars(data, info.width, info.height, stars, arcsecPerPx);
  const objectSrc = entry.src.replace(/\.webp$/, "-object.webp");
  await sharp(Buffer.from(data), { raw: { width: info.width, height: info.height, channels: 3 } })
    .median(7)
    .webp({ quality: 80 })
    .toFile(path.join(REF_DIR, objectSrc));
  console.log(`✓ ${targetId}: ${counts.kept} stars${cached ? " (reused)" : ` (Hip ${counts.hipparcos}, Tycho-2 ${counts.tycho2}, Gaia ${counts.gaia})`}`);
  return { targetId, objectSrc, queries, count: counts.kept };
}

await mkdir(STAR_DIR, { recursive: true });
const refManifest = JSON.parse(await readFile(REF_MANIFEST, "utf8"));
let starManifest = { fields: [] };
try {
  starManifest = JSON.parse(await readFile(STAR_MANIFEST, "utf8"));
} catch {
  // first run
}
const todo = refManifest.images.filter((i) => i.kind === "field" && (!ONLY || ONLY.includes(i.targetId)));
const results = [];
const failures = [];
for (const entry of todo) {
  try {
    results.push(await processTarget(entry));
  } catch (e) {
    failures.push(entry.targetId);
    console.error(`✗ ${entry.targetId}: ${e.message}`);
  }
}

for (const r of results) {
  const img = refManifest.images.find((i) => i.targetId === r.targetId);
  img.objectSrc = r.objectSrc;
  img.objectProcessing =
    "Stars removed for the eyepiece view: catalogue stars masked with the surrounding sky level, then a 7-pixel median filter to remove fainter plate stars.";
}
await writeFile(REF_MANIFEST, `${JSON.stringify(refManifest, null, 2)}\n`);

const now = new Date().toISOString();
const byId = new Map(starManifest.fields.map((f) => [f.targetId, f]));
for (const r of results)
  byId.set(r.targetId, {
    targetId: r.targetId,
    src: `/stars/${r.targetId}.json`,
    stars: r.count,
    queryUrls: r.queries ?? byId.get(r.targetId)?.queryUrls,
    retrievedAt: r.queries ? now : (byId.get(r.targetId)?.retrievedAt ?? now),
  });
starManifest = {
  generatedBy: "scripts/fetch-star-fields.mjs",
  credit:
    "Stars: ESA Gaia DR3 (Gaia Collaboration, 2023), Tycho-2 (Høg et al., 2000) and Hipparcos (ESA, 1997), via the VizieR service (CDS, Strasbourg; CfA mirror).",
  license: "Gaia data: CC BY-SA 3.0 IGO. Catalogues used with acknowledgement.",
  licenseUrl: "https://www.cosmos.esa.int/web/gaia-users/license",
  coverage: { brightRadiusDeg: BRIGHT_RADIUS_DEG, brightLimitMag: TYCHO_LIMIT, faintRadiusDeg: FAINT_RADIUS_DEG, faintLimitMag: FAINT_LIMIT },
  fields: [...byId.values()].sort((a, b) => a.targetId.localeCompare(b.targetId)),
};
await writeFile(STAR_MANIFEST, `${JSON.stringify(starManifest, null, 2)}\n`);
console.log(`Done: ${results.length} fields${failures.length ? `; failed: ${failures.join(", ")}` : ""}`);
