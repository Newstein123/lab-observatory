#!/usr/bin/env node
/**
 * Fetch, verify and prepare the lunar data used by the Object Explorer.
 *
 *   node scripts/fetch-lunar-data.mjs            # everything missing
 *   node scripts/fetch-lunar-data.mjs --force    # refetch everything
 *   node scripts/fetch-lunar-data.mjs --only=features,terrain:tycho
 *
 * Writes:
 *  - src/modules/explorer/lunar/features.json   IAU names, positions, sizes (USGS Gazetteer)
 *  - src/modules/explorer/lunar/assets.json     provenance of every asset below
 *  - public/explorer/moon/albedo-{2k,4k}.webp   LROC WAC global mosaic (NASA SVS CGI Moon Kit)
 *  - public/explorer/moon/elevation-4ppd.i16    LOLA global elevation, int16 metres (NASA SVS CGI Moon Kit)
 *  - public/explorer/moon/terrain/<id>.dem.i16  LOLA 118 m elevation crop around a landmark (USGS)
 *  - public/explorer/moon/terrain/<id>.albedo.webp  LROC WAC 100 m crop of the same window (USGS)
 *
 * The USGS global rasters are 6–8 GB uncompressed GeoTIFFs with one row per
 * strip, so a crop reads only the bytes it needs with HTTP range requests.
 * All sources are public domain (NASA / USGS); anything else aborts the run.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fromArrayBuffer, fromUrl } from "geotiff";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "explorer", "moon");
const DATA = path.join(ROOT, "src", "modules", "explorer", "lunar");
const MANIFEST = path.join(DATA, "assets.json");
const FEATURES = path.join(DATA, "features.json");
const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const wanted = (key) => !ONLY || ONLY.some((o) => o === key || key.startsWith(`${o}:`));
const run = promisify(execFile);
const today = new Date().toISOString().slice(0, 10);

const MOON_RADIUS_KM = 1737.4;
const KM_PER_DEG = (Math.PI * MOON_RADIUS_KM) / 180;

const SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720";
const SVS_PAGE = "https://svs.gsfc.nasa.gov/4720";
const USGS_S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic";
const GAZETTEER_ZIP = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip";

const SOURCES = {
  svsMoonKit: {
    name: "NASA Scientific Visualization Studio — CGI Moon Kit",
    pageUrl: SVS_PAGE,
    credit: "NASA's Scientific Visualization Studio; LRO LROC WAC (NASA/GSFC/Arizona State University) and LOLA (NASA/GSFC)",
    license: "Public domain",
  },
  lolaLdem118: {
    name: "USGS Astrogeology — Moon LRO LOLA Global LDEM 118 m (v1, March 2014)",
    pageUrl: "https://astrogeology.usgs.gov/search/map/moon_lro_lola_global_ldem_118m",
    credit: "NASA/GSFC LOLA Science Team; USGS Astrogeology Science Center",
    license: "Public domain",
  },
  wac100m: {
    name: "USGS Astrogeology — Moon LRO LROC WAC Global Morphologic Mosaic 100 m (June 2013)",
    pageUrl: "https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m",
    credit: "NASA/GSFC/Arizona State University; USGS Astrogeology Science Center",
    license: "Public domain",
  },
  gazetteer: {
    name: "IAU/USGS Gazetteer of Planetary Nomenclature",
    pageUrl: "https://planetarynames.wr.usgs.gov/Page/MOON/target",
    credit: "IAU Working Group for Planetary System Nomenclature; USGS Astrogeology Science Center",
    license: "Public domain",
  },
};

/**
 * Curated landmarks: notable from a small telescope. `name` is the IAU name
 * exactly as in the Gazetteer; `terrain` asks for an elevation crop, its
 * window `factor` × the feature's diameter (rays need a wider view).
 */
const CURATED = [
  { name: "Tycho", priority: 1, terrain: { factor: 3.2 } },
  { name: "Copernicus", priority: 1, terrain: { factor: 2.6 } },
  { name: "Plato", priority: 1, terrain: { factor: 2.4 } },
  { name: "Aristarchus", priority: 2, terrain: { factor: 3.5 } },
  { name: "Kepler", priority: 2, terrain: { factor: 3.5 } },
  { name: "Clavius", priority: 1, terrain: { factor: 1.6 } },
  { name: "Theophilus", priority: 2, terrain: { factor: 2.2 } },
  { name: "Ptolemaeus", priority: 2 },
  { name: "Alphonsus", priority: 3 },
  { name: "Arzachel", priority: 3 },
  { name: "Cyrillus", priority: 3 },
  { name: "Catharina", priority: 3 },
  { name: "Langrenus", priority: 2 },
  { name: "Petavius", priority: 2 },
  { name: "Grimaldi", priority: 2 },
  { name: "Posidonius", priority: 3 },
  { name: "Archimedes", priority: 2 },
  { name: "Eratosthenes", priority: 3 },
  { name: "Gassendi", priority: 2 },
  { name: "Schickard", priority: 3 },
  { name: "Mare Imbrium", priority: 1 },
  { name: "Mare Serenitatis", priority: 1 },
  { name: "Mare Tranquillitatis", priority: 1 },
  { name: "Mare Crisium", priority: 1 },
  { name: "Mare Fecunditatis", priority: 2 },
  { name: "Mare Nectaris", priority: 2 },
  { name: "Mare Nubium", priority: 2 },
  { name: "Mare Humorum", priority: 2 },
  { name: "Mare Frigoris", priority: 2 },
  { name: "Mare Vaporum", priority: 3 },
  { name: "Oceanus Procellarum", priority: 1 },
  { name: "Sinus Iridum", priority: 2 },
  { name: "Sinus Medii", priority: 3 },
  { name: "Montes Apenninus", priority: 2 },
  { name: "Montes Alpes", priority: 2 },
  { name: "Montes Caucasus", priority: 3 },
  { name: "Montes Carpatus", priority: 3 },
  { name: "Mons Piton", priority: 3 },
  { name: "Mons Pico", priority: 3 },
  { name: "Vallis Alpes", priority: 2 },
  { name: "Vallis Schröteri", priority: 3 },
  { name: "Rupes Recta", priority: 2 },
  { name: "Statio Tranquillitatis", priority: 3 },
];

const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const norm180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

async function fetchBuffer(url) {
  const { stdout } = await run("curl", ["-sSfL", "--retry", "3", "--max-time", "600", String(url)], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 1024,
  });
  return stdout;
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { generatedBy: "scripts/fetch-lunar-data.mjs", sources: SOURCES, assets: {} };
  }
}

// ── Gazetteer ────────────────────────────────────────────────────────────

/** Minimal dBASE III reader: enough for the Gazetteer's attribute table. */
function readDbf(buf) {
  const n = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields = [];
  for (let o = 32; buf[o] !== 0x0d; o += 32) {
    fields.push({ name: buf.subarray(o, o + 11).toString("latin1").replace(/\0.*$/, ""), len: buf[o + 16] });
  }
  const rows = [];
  for (let i = 0; i < n; i++) {
    let p = headerLen + i * recLen + 1;
    const row = {};
    for (const f of fields) {
      row[f.name] = buf.subarray(p, p + f.len).toString("utf8").trim();
      p += f.len;
    }
    rows.push(row);
  }
  return rows;
}

async function fetchFeatures() {
  const dir = await mkdtemp(path.join(tmpdir(), "gazetteer-"));
  try {
    const zip = path.join(dir, "g.zip");
    await writeFile(zip, await fetchBuffer(GAZETTEER_ZIP));
    await run("unzip", ["-q", "-o", zip, "*.dbf", "-d", dir]);
    const rows = readDbf(await readFile(path.join(dir, "MOON_nomenclature_center_pts.dbf")));
    const byName = new Map(rows.map((r) => [r.clean_name, r]));
    const features = CURATED.map((c) => {
      const r = byName.get(c.name) ?? rows.find((x) => x.name === c.name);
      if (!r) throw new Error(`Not in the Gazetteer: ${c.name}`);
      if (r.approval !== "Adopted by IAU") throw new Error(`${c.name}: not an adopted IAU name (${r.approval})`);
      return {
        id: slug(c.name),
        name: r.name,
        type: r.type.split(",")[0].trim(),
        typeCode: r.code,
        latDeg: round(Number(r.center_lat)),
        lonDeg: round(norm180(Number(r.center_lon))),
        diameterKm: round(Number(r.diameter), 1),
        extent: {
          minLatDeg: round(Number(r.min_lat)),
          maxLatDeg: round(Number(r.max_lat)),
          minLonDeg: round(norm180(Number(r.min_lon))),
          maxLonDeg: round(norm180(Number(r.max_lon))),
        },
        nameOrigin: r.origin,
        approvalDate: r.approvaldt.slice(0, 10).replaceAll("/", "-"),
        gazetteerUrl: r.link.replace("http://", "https://"),
        priority: c.priority,
        terrain: Boolean(c.terrain),
      };
    });
    const out = {
      generatedBy: "scripts/fetch-lunar-data.mjs",
      source: "gazetteer",
      retrievedAt: today,
      note: "Centre latitude (planetocentric) and longitude (east-positive, −180…180), diameter and extent as published by the Gazetteer. Do not edit by hand.",
      features,
    };
    await mkdir(DATA, { recursive: true });
    await writeFile(FEATURES, JSON.stringify(out, null, 2) + "\n");
    console.log(`features.json: ${features.length} features`);
    return features;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ── Global maps (SVS CGI Moon Kit) ───────────────────────────────────────

async function fetchAlbedo(manifest, key, file, width) {
  const out = path.join(OUT, `albedo-${key}.webp`);
  const buf = await fetchBuffer(`${SVS}/${file}`);
  const img = sharp(buf, { limitInputPixels: false }).resize(width, width / 2).removeAlpha();
  const info = await img.webp({ quality: 88, effort: 5 }).toFile(out);
  manifest.assets[`albedo-${key}`] = {
    src: `/explorer/moon/albedo-${key}.webp`,
    kind: "observation-mosaic",
    widthPx: info.width,
    heightPx: info.height,
    bytes: info.size,
    projection: "equirectangular, longitude −180° (left) … +180° (right), latitude +90° (top) … −90° (bottom)",
    source: "svsMoonKit",
    sourceFile: `${SVS}/${file}`,
    processing: `Resized to ${info.width}×${info.height} and encoded as WebP (quality 88).`,
    notes: [
      "LRO Wide Angle Camera mosaic taken with the Sun high over each area: it shows brightness (albedo), not the shadows seen near the terminator.",
      "Polar gaps are filled from other LROC data in the source kit.",
    ],
    retrievedAt: today,
  };
  console.log(`albedo-${key}.webp: ${info.width}×${info.height}, ${(info.size / 1e6).toFixed(1)} MB`);
}

async function fetchGlobalElevation(manifest) {
  const buf = await fetchBuffer(`${SVS}/ldem_4.tif`);
  const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const image = await tiff.getImage();
  const [raster] = await image.readRasters();
  const w = image.getWidth();
  const h = image.getHeight();
  // Kilometres relative to the 1737.4 km reference sphere → int16 metres.
  const out = new Int16Array(w * h);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < out.length; i++) {
    const m = Math.round(raster[i] * 1000);
    out[i] = m;
    if (m < min) min = m;
    if (m > max) max = m;
  }
  await writeFile(path.join(OUT, "elevation-4ppd.i16"), Buffer.from(out.buffer));
  manifest.assets["elevation-global"] = {
    src: "/explorer/moon/elevation-4ppd.i16",
    kind: "elevation-model",
    format: "int16 little-endian, metres above the 1737.4 km reference sphere, row-major from the north-west corner",
    widthPx: w,
    heightPx: h,
    minM: min,
    maxM: max,
    metresPerPx: Math.round((KM_PER_DEG / 4) * 1000),
    projection: "equirectangular, longitude −180° … +180°, latitude +90° … −90°",
    source: "svsMoonKit",
    sourceFile: `${SVS}/ldem_4.tif`,
    processing: "Float kilometres converted to whole metres (int16). No resampling.",
    notes: ["LOLA laser altimetry gridded at 4 pixels per degree (about 7.6 km per pixel)."],
    retrievedAt: today,
  };
  console.log(`elevation-4ppd.i16: ${w}×${h}, ${min}…${max} m`);
}

// ── Terrain crops (USGS global rasters, by HTTP range) ───────────────────

/**
 * A remote single-band, uncompressed, one-row-per-strip GeoTIFF in simple
 * cylindrical projection covering the whole Moon. Verifies the layout, then
 * reads row slices with range requests.
 */
async function openStripRaster(url) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();
  const fd = image.fileDirectory;
  const width = image.getWidth();
  const height = image.getHeight();
  const bytesPerSample = image.getBitsPerSample() / 8;
  const compression = fd.hasTag?.("Compression") === false ? undefined : await fd.loadValue("Compression");
  if (compression !== undefined && compression !== 1) throw new Error(`${url}: compressed (${compression})`);
  if (image.getTileHeight() !== 1 || image.getSamplesPerPixel() !== 1) throw new Error(`${url}: unexpected layout`);
  const offsets = await fd.loadValue("StripOffsets");
  const first = Number(offsets[0]);
  const rowBytes = width * bytesPerSample;
  if (Number(offsets[offsets.length - 1]) - first !== (offsets.length - 1) * rowBytes) throw new Error(`${url}: strips not contiguous`);
  const [x0, , x1] = image.getBoundingBox();
  if (Math.abs(x1 + x0) > 50_000) throw new Error(`${url}: not centred on longitude 0`);

  const ppd = width / 360;
  async function readRow(row, col0, col1) {
    const start = first + row * rowBytes + col0 * bytesPerSample;
    const end = first + row * rowBytes + (col1 + 1) * bytesPerSample - 1;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
        if (res.status !== 206) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (e) {
        if (attempt >= 4) throw e;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  return { width, height, ppd, bytesPerSample, readRow };
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

/**
 * Sample a raster on an N×N grid covering `sideKm` around (lat, lon), in a
 * local equirectangular frame (north up, east right). Bilinear in rows and
 * columns; returns Float32 samples (raw values) and NaN for no-data.
 */
async function sampleWindow(raster, latDeg, lonDeg, sideKm, n, { decode, noData }) {
  const halfDegLat = sideKm / 2 / KM_PER_DEG;
  const lats = Array.from({ length: n }, (_, i) => latDeg + halfDegLat - ((i + 0.5) / n) * 2 * halfDegLat);
  const halfDegLonMax = Math.max(...lats.map((la) => sideKm / 2 / (KM_PER_DEG * Math.cos((la * Math.PI) / 180))));
  // Source columns, as a contiguous span (the window never crosses ±180° for near-side features).
  const lonToCol = (lo) => (lo + 180) * raster.ppd - 0.5;
  const col0 = Math.max(0, Math.floor(lonToCol(lonDeg - halfDegLonMax)) - 1);
  const col1 = Math.min(raster.width - 1, Math.ceil(lonToCol(lonDeg + halfDegLonMax)) + 1);
  const latToRow = (la) => (90 - la) * raster.ppd - 0.5;
  const rowsNeeded = new Set();
  for (const la of lats) {
    const r = latToRow(la);
    rowsNeeded.add(Math.floor(r));
    rowsNeeded.add(Math.floor(r) + 1);
  }
  const rows = [...rowsNeeded].sort((a, b) => a - b);
  const data = new Map();
  await pool(rows, 24, async (row) => data.set(row, await raster.readRow(row, col0, col1)));

  const value = (row, col) => {
    const buf = data.get(row);
    const c = Math.min(col1, Math.max(col0, col)) - col0;
    const v = decode(buf, c * raster.bytesPerSample);
    return v === noData ? NaN : v;
  };
  const out = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    const la = lats[i];
    const r = latToRow(la);
    const r0 = Math.floor(r);
    const fr = r - r0;
    const kmPerDegLon = KM_PER_DEG * Math.cos((la * Math.PI) / 180);
    for (let j = 0; j < n; j++) {
      const xKm = ((j + 0.5) / n - 0.5) * sideKm;
      const c = lonToCol(lonDeg + xKm / kmPerDegLon);
      const c0 = Math.floor(c);
      const fc = c - c0;
      const v =
        (1 - fr) * ((1 - fc) * value(r0, c0) + fc * value(r0, c0 + 1)) + fr * ((1 - fc) * value(r0 + 1, c0) + fc * value(r0 + 1, c0 + 1));
      out[i * n + j] = v;
    }
  }
  return { samples: out, rowsRead: rows.length, colsRead: col1 - col0 + 1 };
}

async function fetchTerrain(manifest, feature, factor, dem, wac) {
  const n = 384;
  const sideKm = Math.round(feature.diameterKm * factor);
  await mkdir(path.join(OUT, "terrain"), { recursive: true });

  const elev = await sampleWindow(dem, feature.latDeg, feature.lonDeg, sideKm, n, {
    decode: (b, o) => b.readInt16LE(o),
    noData: -32768,
  });
  const metres = new Int16Array(n * n);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < metres.length; i++) {
    const m = Math.round(elev.samples[i] * 0.5); // label: Multiplier = 0.5 m
    if (!Number.isFinite(m)) throw new Error(`${feature.id}: no-data in elevation window`);
    metres[i] = m;
    if (m < min) min = m;
    if (m > max) max = m;
  }
  await writeFile(path.join(OUT, "terrain", `${feature.id}.dem.i16`), Buffer.from(metres.buffer));

  const alb = await sampleWindow(wac, feature.latDeg, feature.lonDeg, sideKm, n, { decode: (b, o) => b.readUInt8(o), noData: 0 });
  const grey = Buffer.alloc(n * n);
  for (let i = 0; i < grey.length; i++) grey[i] = Math.max(0, Math.min(255, Math.round(alb.samples[i] || 0)));
  const albInfo = await sharp(grey, { raw: { width: n, height: n, channels: 1 } })
    .webp({ quality: 90 })
    .toFile(path.join(OUT, "terrain", `${feature.id}.albedo.webp`));

  const window = { centreLatDeg: feature.latDeg, centreLonDeg: feature.lonDeg, sideKm, samples: n, kmPerSample: round(sideKm / n, 4) };
  manifest.assets[`terrain-${feature.id}-dem`] = {
    src: `/explorer/moon/terrain/${feature.id}.dem.i16`,
    kind: "elevation-model",
    featureId: feature.id,
    format: "int16 little-endian, metres above the 1737.4 km reference sphere, N×N row-major from the north-west corner",
    window,
    minM: min,
    maxM: max,
    source: "lolaLdem118",
    sourceFile: `${USGS_S3}/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif`,
    processing: `Read ${elev.rowsRead} rows × ${elev.colsRead} columns by HTTP range; bilinear resampling to a ${n}×${n} local grid (north up, ${round(sideKm / n, 3)} km per sample); raw values × 0.5 m.`,
    notes: ["Source grid is about 118 m per pixel; smaller details are not in the data."],
    retrievedAt: today,
  };
  manifest.assets[`terrain-${feature.id}-albedo`] = {
    src: `/explorer/moon/terrain/${feature.id}.albedo.webp`,
    kind: "observation-mosaic",
    featureId: feature.id,
    widthPx: n,
    heightPx: n,
    bytes: albInfo.size,
    window,
    source: "wac100m",
    sourceFile: `${USGS_S3}/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif`,
    processing: `Read by HTTP range; bilinear resampling to the same ${n}×${n} grid as the elevation crop.`,
    notes: ["Morphologic mosaic: images taken with the Sun at moderate angles, so relief shading is included."],
    retrievedAt: today,
  };
  console.log(`terrain ${feature.id}: ${sideKm} km, ${min}…${max} m`);
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest = await readManifest();
  manifest.sources = SOURCES;
  const has = (k) => !FORCE && manifest.assets[k];

  let features;
  if (wanted("features") || FORCE) features = await fetchFeatures();
  else features = JSON.parse(await readFile(FEATURES, "utf8")).features;

  if (wanted("albedo") && !has("albedo-2k")) await fetchAlbedo(manifest, "2k", "lroc_color_poles_2k.tif", 2048);
  if (wanted("albedo") && !has("albedo-4k")) await fetchAlbedo(manifest, "4k", "lroc_color_poles_4k.tif", 4096);
  if (wanted("elevation") && !has("elevation-global")) await fetchGlobalElevation(manifest);

  const terrain = CURATED.filter((c) => c.terrain && wanted(`terrain:${slug(c.name)}`) && !has(`terrain-${slug(c.name)}-dem`));
  if (terrain.length) {
    const dem = await openStripRaster(`${USGS_S3}/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif`);
    const wac = await openStripRaster(`${USGS_S3}/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif`);
    for (const c of terrain) {
      const f = features.find((x) => x.id === slug(c.name));
      await fetchTerrain(manifest, f, c.terrain.factor, dem, wac);
      await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
    }
  }

  manifest.generatedBy = "scripts/fetch-lunar-data.mjs";
  manifest.assets = Object.fromEntries(Object.entries(manifest.assets).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
