#!/usr/bin/env node
/**
 * Data for the planetary explorer (Jupiter, Saturn).
 *
 *   node scripts/fetch-planet-data.mjs [--only=saturn-moons,jupiter-map]
 *
 * Writes:
 *  - src/modules/explorer/saturn/moons.json    Mean-orbit models of Saturn's eight major moons,
 *      fitted to JPL Horizons state vectors (sat441) over 2022–2032, with fit residuals
 *      and physical data from the Horizons headers.
 *  - src/modules/explorer/saturn/moons.check.json   Horizons astrometric RA/Dec of Saturn and
 *      each moon at a few dates, for the unit tests.
 *  - public/explorer/jupiter/map-2k.webp + src/modules/explorer/jupiter/assets.json
 *      Cassini global map of Jupiter (PIA07782, Dec 2000), with the Great Red Spot's
 *      position located in the image.
 */
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const wanted = (k) => !ONLY || ONLY.includes(k);
const run = promisify(execFile);
const today = new Date().toISOString().slice(0, 10);
const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api";

async function fetchText(url) {
  const { stdout } = await run("curl", ["-sSfL", "--retry", "3", "--max-time", "300", "-A", "UniversalObservatory-dev/0.1", url], { maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}
async function fetchBuffer(url) {
  const { stdout } = await run("curl", ["-sSfL", "--retry", "3", "--max-time", "300", "-A", "UniversalObservatory-dev/0.1", url], { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}
const horizons = async (params) => {
  const q = new URLSearchParams({ format: "json", MAKE_EPHEM: "YES", OBJ_DATA: "YES", ...params });
  const json = JSON.parse(await fetchText(`${HORIZONS}?${q.toString().replaceAll("+", "%20")}`));
  if (!json.result) throw new Error(`Horizons: ${JSON.stringify(json).slice(0, 300)}`);
  return json.result;
};

// ── Saturn's moons ───────────────────────────────────────────────────────

/** Typical opposition magnitudes (JPL Planetary Satellite Physical Parameters); segment length of the fit, days. */
const SATURN_MOONS = [
  { id: "mimas", name: "Mimas", code: "601", magnitude: 12.9, segmentDays: 15 },
  { id: "enceladus", name: "Enceladus", code: "602", magnitude: 11.7, segmentDays: 365.25 },
  { id: "tethys", name: "Tethys", code: "603", magnitude: 10.2, segmentDays: 365.25 },
  { id: "dione", name: "Dione", code: "604", magnitude: 10.4, segmentDays: 365.25 },
  { id: "rhea", name: "Rhea", code: "605", magnitude: 9.7, segmentDays: 365.25 },
  { id: "titan", name: "Titan", code: "606", magnitude: 8.4, segmentDays: 365.25 },
  { id: "hyperion", name: "Hyperion", code: "607", magnitude: 14.4, segmentDays: 30 },
  { id: "iapetus", name: "Iapetus", code: "608", magnitude: 11.0, segmentDays: 730.5 },
];
const START = "2022-01-01";
const STOP = "2032-01-01";

const header = (text, re) => {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
};

function parseVectors(result) {
  const body = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!body) throw new Error("No vectors in Horizons output");
  const rows = [];
  for (const line of body.trim().split("\n")) {
    const f = line.split(",").map((s) => s.trim());
    if (f.length < 5) continue;
    rows.push({ jd: Number(f[0]), p: [Number(f[2]), Number(f[3]), Number(f[4])] });
  }
  return rows;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a);
  return a.map((x) => x / l);
};

/** Least squares by normal equations (small systems). */
function lstsq(rows, ys) {
  const n = rows[0].length;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  rows.forEach((r, k) => {
    for (let i = 0; i < n; i++) {
      b[i] += r[i] * ys[k];
      for (let j = 0; j < n; j++) A[i][j] += r[i] * r[j];
    }
  });
  // Gaussian elimination with partial pivoting.
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
      b[k] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

/**
 * Periodic basis in the mean longitude λ, with slowly varying amplitudes
 * (t terms) for apsidal and nodal precession: must match saturn-moons.ts.
 */
function basis(lambdaDeg, tDays, tScale) {
  const l = (lambdaDeg * Math.PI) / 180;
  const t = tDays / tScale;
  return [Math.sin(l), Math.cos(l), t * Math.sin(l), t * Math.cos(l), t * t * Math.sin(l), t * t * Math.cos(l), Math.sin(2 * l), Math.cos(2 * l), t * Math.sin(2 * l), t * Math.cos(2 * l)];
}

/** One fit over a time segment; positions relative to the segment's mid-point epoch. */
function fitSegment(rows, epochJd, tScale) {
  // Orbit plane: mean angular momentum direction.
  let h = [0, 0, 0];
  for (let k = 0; k + 1 < rows.length; k++) {
    const c = cross(rows[k].p, rows[k + 1].p);
    h = [h[0] + c[0], h[1] + c[1], h[2] + c[2]];
  }
  h = norm(h);
  const e1 = norm(cross([0, 0, 1], h)); // ascending node on the ICRF equator
  const e2 = cross(h, e1);
  const t = rows.map((r) => r.jd - epochJd);
  // Unwrapped in-plane angle, radius, out-of-plane distance.
  const theta = [];
  let prev;
  let turns = 0;
  for (const r of rows) {
    let a = (Math.atan2(dot(r.p, e2), dot(r.p, e1)) * 180) / Math.PI;
    if (prev !== undefined) {
      if (a - prev < -180) turns += 360;
      else if (a - prev > 180) turns -= 360;
    }
    prev = a;
    theta.push(a + turns);
  }
  const radius = rows.map((r) => Math.hypot(...r.p));
  const zOut = rows.map((r) => dot(r.p, h));

  // Mean motion and epoch longitude, then periodic terms; iterate.
  let [l0, n] = lstsq(t.map((x) => [1, x]), theta);
  let thetaTerms = [];
  for (let iter = 0; iter < 3; iter++) {
    const sol = lstsq(
      t.map((x) => [1, x, ...basis(l0 + n * x, x, tScale)]),
      theta,
    );
    [l0, n] = sol;
    thetaTerms = sol.slice(2);
  }
  const lam = t.map((x) => l0 + n * x);
  const rSol = lstsq(t.map((x, k) => [1, ...basis(lam[k], x, tScale)]), radius);
  const zSol = lstsq(t.map((x, k) => basis(lam[k], x, tScale).slice(0, 6)), zOut);

  // Residuals as 3D position error.
  let maxErr = 0;
  let sumErr = 0;
  rows.forEach((r, k) => {
    const p = evaluate({ h, e1, e2, l0, n, thetaTerms, rTerms: rSol, zTerms: zSol, tScale }, t[k]);
    const err = Math.hypot(p[0] - r.p[0], p[1] - r.p[1], p[2] - r.p[2]);
    maxErr = Math.max(maxErr, err);
    sumErr += err * err;
  });
  const r6 = (x) => Math.round(x * 1e9) / 1e9;
  return {
    model: { epochJd, tScale, h: h.map(r6), e1: e1.map(r6), e2: e2.map(r6), l0: r6(l0), n: r6(n), thetaTerms: thetaTerms.map(r6), rTerms: rSol.map(r6), zTerms: zSol.map(r6) },
    maxErr,
    sumErr,
  };
}

/** Piecewise fit: one segment per `segmentDays`, so resonant librations are followed. */
function fitMoon(rows, segmentDays) {
  const segments = [];
  let maxErr = 0;
  let sumErr = 0;
  const first = rows[0].jd;
  const last = rows[rows.length - 1].jd;
  for (let a = first; a < last - 1; a += segmentDays) {
    // A short remainder joins the last full segment.
    const b = last - (a + segmentDays) < segmentDays / 2 ? last : a + segmentDays;
    // Fit with a small overlap so neighbouring segments agree at the joins.
    const pad = segmentDays * 0.1;
    const seg = rows.filter((r) => r.jd >= a - pad && r.jd <= b + pad);
    const f = fitSegment(seg, (a + b) / 2, (b - a) / 2 + pad);
    segments.push({ startJd: a, endJd: b, ...f.model });
    maxErr = Math.max(maxErr, f.maxErr);
    sumErr += f.sumErr;
    if (b === last) break;
  }
  return { segments, residualKm: { max: Math.round(maxErr), rms: Math.round(Math.sqrt(sumErr / rows.length)) } };
}

function evaluate(m, tDays) {
  const lam = m.l0 + m.n * tDays;
  const b = basis(lam, tDays, m.tScale);
  const th = lam + m.thetaTerms.reduce((s, c, i) => s + c * b[i], 0);
  const r = m.rTerms[0] + m.rTerms.slice(1).reduce((s, c, i) => s + c * b[i], 0);
  const z = m.zTerms.reduce((s, c, i) => s + c * b[i], 0);
  const a = (th * Math.PI) / 180;
  const inPlane = Math.sqrt(Math.max(0, r * r - z * z));
  return [0, 1, 2].map((i) => inPlane * (Math.cos(a) * m.e1[i] + Math.sin(a) * m.e2[i]) + z * m.h[i]);
}

async function saturnMoons() {
  const out = [];
  for (const moon of SATURN_MOONS) {
    const result = await horizons({
      COMMAND: `'${moon.code}'`,
      EPHEM_TYPE: "VECTORS",
      CENTER: "'500@699'",
      START_TIME: `'${START}'`,
      STOP_TIME: `'${STOP}'`,
      STEP_SIZE: "'24000'",
      REF_PLANE: "FRAME",
      REF_SYSTEM: "ICRF",
      VEC_TABLE: "1",
      OUT_UNITS: "KM-S",
      CSV_FORMAT: "YES",
      VEC_LABELS: "NO",
    });
    const rows = parseVectors(result);
    const { segments, residualKm } = fitMoon(rows, moon.segmentDays);
    const physical = {
      meanRadiusKm: header(result, /Mean Radius \(km\)\s*=\s*([\d.]+)/i) ?? header(result, /Radius \(km\)\s*=\s*([\d.]+)/i),
      semiMajorAxisKm: (() => {
        const v = header(result, /Semi-major axis, a \(km\)\s*=\s*([\d.]+)/i);
        return v !== undefined ? Math.round(v * 1000) : undefined;
      })(),
      orbitalPeriodDays: header(result, /Orbital period\s*=\s*([\d.]+)/i),
      eccentricity: header(result, /Eccentricity, e\s*=\s*([\d.]+)/i),
      geometricAlbedo: header(result, /Geometric Albedo\s*=\s*([\d.]+)/i),
    };
    const { segmentDays, ...meta } = moon;
    out.push({ ...meta, physical, residualKm, samples: rows.length, segmentDays, segments });
    console.log(`${moon.name}: ${rows.length} vectors, fit residual max ${residualKm.max} km, rms ${residualKm.rms} km`);
  }
  const dir = path.join(ROOT, "src", "modules", "explorer", "saturn");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "moons.json"),
    JSON.stringify(
      {
        generatedBy: "scripts/fetch-planet-data.mjs",
        source: "JPL Horizons, satellite ephemeris sat441 (state vectors, Saturn-centred, ICRF)",
        sourceUrl: "https://ssd.jpl.nasa.gov/horizons/",
        retrievedAt: today,
        fitSpan: [START, STOP],
        method:
          "Piecewise (one segment per year; Mimas 15 days, Hyperion 30 days, Iapetus 2 years): mean longitude with periodic terms in λ and 2λ whose amplitudes vary slowly in time, plus radius and out-of-plane offset, fitted by least squares to geometric Saturn-centred positions. Valid within the fitted span only.",
        moons: out,
      },
      null,
      0,
    ) + "\n",
  );

  // Check points: astrometric RA/Dec from Earth (geocentre) of Saturn and each moon.
  const dates = ["2026-11-21 14:00", "2027-08-15 03:00", "2029-03-02 20:00"];
  const obs = async (code) => {
    const r = await horizons({
      COMMAND: `'${code}'`,
      EPHEM_TYPE: "OBSERVER",
      CENTER: "'500@399'",
      TLIST: dates.map((d) => `'${d}'`).join(" "),
      TIME_TYPE: "UT",
      QUANTITIES: "'1'",
      ANG_FORMAT: "DEG",
      CSV_FORMAT: "YES",
      EXTRA_PREC: "YES",
    });
    const body = r.split("$$SOE")[1].split("$$EOE")[0].trim().split("\n");
    return body.map((line) => {
      const f = line.split(",").map((s) => s.trim());
      return { raDeg: Number(f[3]), decDeg: Number(f[4]) };
    });
  };
  const saturn = await obs("699");
  const checks = [];
  for (const moon of SATURN_MOONS) {
    const m = await obs(moon.code);
    dates.forEach((d, i) => {
      const dRa = (m[i].raDeg - saturn[i].raDeg) * Math.cos((saturn[i].decDeg * Math.PI) / 180) * 3600;
      const dDec = (m[i].decDeg - saturn[i].decDeg) * 3600;
      checks.push({ moon: moon.id, utc: d.replace(" ", "T") + ":00Z", eastArcsec: Math.round(dRa * 100) / 100, northArcsec: Math.round(dDec * 100) / 100 });
    });
  }
  await writeFile(
    path.join(dir, "moons.check.json"),
    JSON.stringify({ source: "JPL Horizons astrometric RA/Dec (geocentric), moon minus Saturn", retrievedAt: today, checks }, null, 1) + "\n",
  );
  console.log(`moons.check.json: ${checks.length} checks`);
}

// ── Jupiter global map ───────────────────────────────────────────────────

async function jupiterMap() {
  // NASA's own copy of the Photojournal release (NASA imagery is not copyrighted).
  const buf = await fetchBuffer("https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia07/pia07782/PIA07782.jpg");
  const { data, info: im } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // Locate the Great Red Spot: the reddest large patch between 15° and 30° S (planetocentric).
  const W = im.width;
  const H = im.height;
  const rowOf = (lat) => Math.round(((90 - lat) / 180) * (H - 1));
  let best = { x: 0, y: 0, score: -Infinity };
  const win = 12;
  for (let y = rowOf(-15); y <= rowOf(-30); y += 2) {
    for (let x = 0; x < W; x += 2) {
      let s = 0;
      for (let dy = -win; dy <= win; dy += 3)
        for (let dx = -win * 2; dx <= win * 2; dx += 3) {
          const i = ((y + dy) * W + ((x + dx + W) % W)) * 3;
          s += data[i] - data[i + 2]; // red minus blue
        }
      if (s > best.score) best = { x, y, score: s };
    }
  }
  const grsU = (best.x + 0.5) / W;
  const grsLatC = 90 - ((best.y + 0.5) / H) * 180;
  const outDir = path.join(ROOT, "public", "explorer", "jupiter");
  await mkdir(outDir, { recursive: true });
  const outInfo = await sharp(buf).resize(2048, 1024).webp({ quality: 88 }).toFile(path.join(outDir, "map-2k.webp"));
  const dataDir = path.join(ROOT, "src", "modules", "explorer", "jupiter");
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    path.join(dataDir, "assets.json"),
    JSON.stringify(
      {
        generatedBy: "scripts/fetch-planet-data.mjs",
        map: {
          src: "/explorer/jupiter/map-2k.webp",
          kind: "observation-mosaic",
          widthPx: outInfo.width,
          heightPx: outInfo.height,
          projection: "simple cylindrical, planetocentric latitude, as seen from outside (east to the right)",
          grsU: Math.round(grsU * 10000) / 10000,
          grsLatCentricDeg: Math.round(grsLatC * 10) / 10,
          source: {
            name: "NASA Photojournal PIA07782 — Cassini's Best Maps of Jupiter (cylindrical map)",
            pageUrl: "https://photojournal.jpl.nasa.gov/catalog/PIA07782",
            credit: "NASA/JPL/Space Science Institute",
            license: "Public domain",
          },
          processing: `Resized to ${outInfo.width}×${outInfo.height}. The Great Red Spot was located automatically (reddest patch 15–30° S) at map x = ${(grsU * 100).toFixed(1)}% to align the map's longitudes with the spot's current estimated position.`,
          notes: [
            "Cassini narrow-angle images from 11–12 December 2000. Jupiter's clouds change constantly: belts, ovals and the Great Red Spot (which has shrunk since) look different today.",
          ],
          retrievedAt: today,
        },
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`jupiter map: ${outInfo.width}×${outInfo.height}, GRS at u=${grsU.toFixed(4)}, lat ${grsLatC.toFixed(1)}°`);
}

async function main() {
  if (wanted("saturn-moons")) await saturnMoons();
  if (wanted("jupiter-map")) await jupiterMap();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
