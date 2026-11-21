#!/usr/bin/env node
/**
 * Catalogue data for the deep-sky explorer: named stars, clusters, nebular
 * regions and companion galaxies inside each target's survey image.
 *
 *   node scripts/fetch-deep-sky.mjs
 *
 * Positions, object types, V magnitudes, sizes, parallaxes and spectral
 * types come from SIMBAD (CDS, via the CfA mirror's TAP service). Writes
 * src/modules/explorer/deep-sky/features.json. Features that fall outside a
 * target's survey image are reported and dropped.
 */
import { execFile } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);
const TAP = "https://simbad.harvard.edu/simbad/sim-tap/sync";
const today = new Date().toISOString().slice(0, 10);

/** kind: what it is, for the explorer; priority: 1 always labelled … 3 only when large. */
const CURATED = [
  // Orion Nebula
  { targetId: "m42", id: "trapezium", query: "NAME Trapezium Cluster", name: "Trapezium Cluster", kind: "cluster", priority: 1 },
  { targetId: "m42", id: "theta1-ori-c", query: "tet01 Ori C", name: "θ¹ Orionis C", kind: "star", priority: 2 },
  { targetId: "m42", id: "m43", query: "M 43", name: "M43 (De Mairan's Nebula)", kind: "nebula", priority: 1 },
  { targetId: "m42", id: "orion-bar", query: "NAME Orion Bright Bar", name: "Orion Bar", kind: "region", priority: 2 },
  { targetId: "m42", id: "orion-kl", query: "NAME Orion-KL", name: "Orion KL (hidden star birth)", kind: "region", priority: 3 },
  { targetId: "m42", id: "running-man", query: "NGC 1977", name: "Running Man Nebula", kind: "nebula", priority: 1 },
  { targetId: "m42", id: "iota-ori", query: "iot Ori", name: "ι Orionis (Hatysa)", kind: "star", priority: 2 },
  // Andromeda
  { targetId: "m31", id: "m32", query: "M 32", name: "M32", kind: "galaxy", priority: 1 },
  { targetId: "m31", id: "m110", query: "M 110", name: "M110", kind: "galaxy", priority: 1 },
  { targetId: "m31", id: "ngc206", query: "NGC 206", name: "NGC 206 star cloud", kind: "region", priority: 2 },
  // Triangulum
  { targetId: "m33", id: "ngc604", query: "NGC 604", name: "NGC 604", kind: "nebula", priority: 1 },
  // Whirlpool
  { targetId: "m51", id: "ngc5195", query: "NGC 5195", name: "NGC 5195", kind: "galaxy", priority: 1 },
  // Pinwheel
  { targetId: "m101", id: "ngc5461", query: "NGC 5461", name: "NGC 5461", kind: "nebula", priority: 2 },
  { targetId: "m101", id: "ngc5462", query: "NGC 5462", name: "NGC 5462", kind: "nebula", priority: 3 },
  { targetId: "m101", id: "ngc5471", query: "NGC 5471", name: "NGC 5471", kind: "nebula", priority: 2 },
  // Bode's and the Cigar
  { targetId: "m81", id: "m82-from-m81", query: "M 82", name: "M82 (Cigar Galaxy)", kind: "galaxy", priority: 1 },
  { targetId: "m82", id: "m81-from-m82", query: "M 81", name: "M81 (Bode's Galaxy)", kind: "galaxy", priority: 1 },
  // Pleiades
  { targetId: "m45", id: "alcyone", query: "eta Tau", name: "Alcyone", kind: "star", priority: 1 },
  { targetId: "m45", id: "atlas", query: "27 Tau", name: "Atlas", kind: "star", priority: 1 },
  { targetId: "m45", id: "electra", query: "17 Tau", name: "Electra", kind: "star", priority: 1 },
  { targetId: "m45", id: "maia", query: "20 Tau", name: "Maia", kind: "star", priority: 1 },
  { targetId: "m45", id: "merope", query: "23 Tau", name: "Merope", kind: "star", priority: 1 },
  { targetId: "m45", id: "taygeta", query: "19 Tau", name: "Taygeta", kind: "star", priority: 1 },
  { targetId: "m45", id: "pleione", query: "28 Tau", name: "Pleione", kind: "star", priority: 2 },
  { targetId: "m45", id: "celaeno", query: "16 Tau", name: "Celaeno", kind: "star", priority: 2 },
  { targetId: "m45", id: "asterope", query: "21 Tau", name: "Asterope", kind: "star", priority: 2 },
  { targetId: "m45", id: "merope-nebula", query: "NGC 1435", name: "Merope Nebula", kind: "nebula", priority: 2 },
  // Beehive
  { targetId: "m44", id: "eps-cnc", query: "eps Cnc", name: "ε Cancri", kind: "star", priority: 1 },
  { targetId: "m44", id: "39-cnc", query: "39 Cnc", name: "39 Cancri", kind: "star", priority: 2 },
  { targetId: "m44", id: "40-cnc", query: "40 Cnc", name: "40 Cancri", kind: "star", priority: 2 },
  { targetId: "m44", id: "42-cnc", query: "42 Cnc", name: "42 Cancri", kind: "star", priority: 2 },
  // Double Cluster
  { targetId: "double-cluster", id: "ngc869", query: "NGC 869", name: "NGC 869 (h Persei)", kind: "cluster", priority: 1 },
  { targetId: "double-cluster", id: "ngc884", query: "NGC 884", name: "NGC 884 (χ Persei)", kind: "cluster", priority: 1 },
  // Lagoon
  { targetId: "m8", id: "ngc6530", query: "NGC 6530", name: "NGC 6530", kind: "cluster", priority: 1 },
  { targetId: "m8", id: "hourglass", query: "NAME Hourglass Nebula", name: "Hourglass Nebula", kind: "region", priority: 2 },
  { targetId: "m8", id: "herschel-36", query: "NAME Herschel 36", name: "Herschel 36", kind: "star", priority: 3 },
  { targetId: "m8", id: "9-sgr", query: "9 Sgr", name: "9 Sagittarii", kind: "star", priority: 2 },
  // Trifid
  { targetId: "m20", id: "hd164492", query: "HD 164492", name: "HD 164492 (the Trifid's central star)", kind: "star", priority: 2 },
  { targetId: "m20", id: "m21", query: "M 21", name: "M21", kind: "cluster", priority: 1 },
  // Crab
  { targetId: "m1", id: "crab-pulsar", query: "NAME Crab Pulsar", name: "Crab Pulsar", kind: "star", priority: 2 },
  // Hercules Cluster
  { targetId: "m13", id: "ngc6207", query: "NGC 6207", name: "NGC 6207", kind: "galaxy", priority: 2 },
];

const norm = (s) => s.replace(/^\*\s+/, "").replace(/^NAME\s+/, "").replace(/\s+/g, " ").trim().toLowerCase();

async function tap(query) {
  const url = `${TAP}?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(query)}`;
  const { stdout } = await run("curl", ["-sSfL", "--retry", "3", "--max-time", "120", url], { maxBuffer: 32 * 1024 * 1024 });
  const json = JSON.parse(stdout);
  const cols = json.metadata.map((m) => m.name);
  return json.data.map((row) => Object.fromEntries(row.map((v, i) => [cols[i], v])));
}

async function main() {
  const ids = CURATED.map((c) => `'${c.query.replaceAll("'", "''")}'`).join(",");
  const rows = await tap(
    `SELECT ident.id AS ident, main_id, ra, dec, otype, galdim_majaxis, galdim_minaxis, plx_value, plx_err, sp_type, flux.flux AS vmag FROM basic JOIN ident ON oid = ident.oidref LEFT JOIN flux ON oid = flux.oidref AND flux.filter = 'V' WHERE ident.id IN (${ids})`,
  );
  const byIdent = new Map(rows.map((r) => [norm(r.ident), r]));
  const images = JSON.parse(await readFile(path.join(ROOT, "src", "modules", "targets", "reference-images.json"), "utf8"));
  const fieldOf = (targetId) => images.images.find((i) => i.targetId === targetId && i.kind === "field");

  const features = [];
  for (const c of CURATED) {
    const r = byIdent.get(norm(c.query));
    if (!r) throw new Error(`SIMBAD did not resolve ${c.query}`);
    const field = fieldOf(c.targetId);
    if (!field) throw new Error(`No survey image for ${c.targetId}`);
    // Offset from the image centre, arcmin, to check the feature is inside the image.
    const d0 = (field.center.decDeg * Math.PI) / 180;
    const east = (r.ra - field.center.raDeg) * Math.cos(d0) * 60;
    const north = (r.dec - field.center.decDeg) * 60;
    if (Math.abs(east) > field.fieldWidthArcsec / 120 || Math.abs(north) > field.fieldHeightArcsec / 120) {
      console.warn(`Outside the ${c.targetId} image, dropped: ${c.name}`);
      continue;
    }
    const round = (x, d) => (x === null || x === undefined ? undefined : Math.round(x * 10 ** d) / 10 ** d);
    features.push({
      targetId: c.targetId,
      id: c.id,
      name: c.name,
      kind: c.kind,
      priority: c.priority,
      simbadId: r.main_id.replace(/\s+/g, " ").trim(),
      simbadUrl: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(r.main_id.replace(/\s+/g, " ").trim())}`,
      otype: r.otype,
      raDeg: round(r.ra, 6),
      decDeg: round(r.dec, 6),
      vMag: round(r.vmag, 2),
      majorArcmin: round(r.galdim_majaxis, 2),
      minorArcmin: round(r.galdim_minaxis, 2),
      parallaxMas: round(r.plx_value, 4),
      parallaxErrMas: round(r.plx_err, 4),
      spType: r.sp_type || undefined,
    });
  }
  const dir = path.join(ROOT, "src", "modules", "explorer", "deep-sky");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "features.json"),
    JSON.stringify(
      {
        generatedBy: "scripts/fetch-deep-sky.mjs",
        source: "SIMBAD astronomical database (CDS, Strasbourg), queried through the CfA mirror",
        sourceUrl: "https://simbad.cds.unistra.fr/simbad/",
        retrievedAt: today,
        note: "ICRS J2000 positions; V magnitudes, sizes (arcmin), parallaxes (mas) and spectral types as listed by SIMBAD. Do not edit by hand.",
        features,
      },
      null,
      1,
    ) + "\n",
  );
  console.log(`features.json: ${features.length} features`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
