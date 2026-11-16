/**
 * A telescope setup packed into a short link, so a phone can open the same
 * setup in AR (e.g. from a QR code on the desktop) without signing in or
 * saving. The link carries only equipment specifications, nothing about the
 * user.
 *
 * Catalogue equipment is referenced by id (`t=skywatcher-explorer-200p`);
 * custom equipment by its few numbers (`t=200,1000,n`). Only the part in the
 * focuser that the model shows is included (eyepiece for visual, camera for
 * imaging), which keeps the QR code small enough to scan easily.
 */
import { z } from "zod";
import { deepEqualJson } from "@/lib/canonical-json";
import { CATALOGS, TELESCOPE_CATALOG } from "@/modules/equipment/catalog";
import { mountSpecSchema, type MountSpec, type MountType } from "@/modules/equipment/models";
import {
  barlowSpecSchema,
  cameraSpecSchema,
  eyepieceSpecSchema,
  filterSpecSchema,
  FILTER_KINDS,
  telescopeOpticsSchema,
  type BarlowSpec,
  type CameraSpec,
  type EyepieceSpec,
  type FilterKind,
  type FilterSpec,
  type OpticalDesign,
  type TelescopeOptics,
} from "@/modules/simulations/engine";

export const arSetupSchema = z.object({
  name: z.string().trim().max(100).optional(),
  mode: z.enum(["visual", "imaging"]),
  telescope: telescopeOpticsSchema,
  mount: mountSpecSchema.optional(),
  eyepiece: eyepieceSpecSchema.optional(),
  camera: cameraSpecSchema.optional(),
  barlow: barlowSpecSchema.optional(),
  filter: filterSpecSchema.optional(),
});

export type ArSetup = z.infer<typeof arSetupSchema>;

type SpecLike = Partial<Omit<ArSetup, "mode" | "telescope">> & { telescope: TelescopeOptics };

/** Keep only what the AR model shows (drops ids, notes, profile links, the unused eyepiece/camera…). */
export function toArSetup(spec: SpecLike, mode: ArSetup["mode"]): ArSetup {
  return arSetupSchema.parse({
    name: spec.name,
    mode,
    telescope: spec.telescope,
    mount: spec.mount,
    eyepiece: mode === "visual" ? spec.eyepiece : undefined,
    camera: mode === "imaging" ? spec.camera : undefined,
    barlow: spec.barlow,
    filter: spec.filter,
  });
}

// --- Compact encodings for custom (non-catalogue) parts ---------------------

const DESIGN_CODE: Record<OpticalDesign, string> = { refractor: "r", reflector: "n", catadioptric: "c" };
const MOUNT_CODE: Record<MountType, string> = { equatorial: "e", alt_azimuth: "a", dobsonian: "d", goto: "g" };
const invert = <K extends string>(o: Record<K, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k])) as Record<string, K>;
const DESIGN_FROM = invert(DESIGN_CODE);
const MOUNT_FROM = invert(MOUNT_CODE);

const num = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
const flag = (v: string | undefined) => (v === undefined || v === "" ? undefined : v === "1");
const list = (...v: (string | number | boolean | undefined)[]) => {
  const out = v.map((x) => (x === undefined ? "" : typeof x === "boolean" ? (x ? "1" : "0") : String(x)));
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join(",");
};

/** Catalogue id of an entry whose specification is exactly this one. */
function catalogId<T>(entries: { id: string; spec: T }[], spec: T | undefined): string | undefined {
  return spec ? entries.find((e) => deepEqualJson(e.spec, spec))?.id : undefined;
}

function fromCatalog<T>(entries: { id: string; spec: T }[], value: string): T | undefined {
  return entries.find((e) => e.id === value)?.spec;
}

const isCustom = (v: string) => /^[\d.,a-z]*$/.test(v) && /^\d/.test(v);

export function arParams(setup: ArSetup): URLSearchParams {
  const p = new URLSearchParams();
  if (setup.name) p.set("n", setup.name.slice(0, 60));
  if (setup.mode === "imaging") p.set("v", "i");
  const t = setup.telescope;
  const scope = TELESCOPE_CATALOG.find((e) => deepEqualJson(e.optics, t));
  p.set("t", scope ? scope.id : list(t.apertureMm, t.focalLengthMm, t.opticalDesign && DESIGN_CODE[t.opticalDesign]));
  if (setup.mount) {
    const m = setup.mount;
    p.set("m", catalogId(CATALOGS.mount, m) ?? list(MOUNT_CODE[m.type], m.payloadKg, m.goto, m.tracking));
  }
  if (setup.eyepiece) {
    const e = setup.eyepiece;
    p.set("e", catalogId(CATALOGS.eyepiece, e) ?? list(e.focalLengthMm, e.apparentFovDeg, e.barrelIn, e.eyeReliefMm));
  }
  if (setup.camera) {
    const c = setup.camera;
    p.set("c", catalogId(CATALOGS.camera, c) ?? list(c.sensorWidthMm, c.sensorHeightMm, c.pixelSizeUm, c.color));
  }
  if (setup.barlow) {
    const b = setup.barlow;
    p.set("b", catalogId(CATALOGS.barlow, b) ?? list(b.factor, b.barrelIn));
  }
  if (setup.filter) {
    // Only the kind matters to the model (its glass tint).
    p.set("f", catalogId(CATALOGS.filter, setup.filter) ?? setup.filter.kind ?? "other");
  }
  return p;
}

/** Path of the AR page for a setup. */
export function arPath(setup: ArSetup): string {
  return `/ar?${arParams(setup).toString()}`;
}

/** Undefined when the link is damaged or describes an impossible setup. */
export function decodeArParams(params: URLSearchParams | Record<string, string | string[] | undefined>): ArSetup | undefined {
  const get = (k: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s === null || s === undefined || s.length > 120 ? undefined : s;
  };
  const t = get("t");
  if (!t) return undefined;
  const mode = get("v") === "i" ? "imaging" : "visual";

  let telescope: TelescopeOptics | undefined;
  if (isCustom(t)) {
    const [a, f, d] = t.split(",");
    telescope = { apertureMm: num(a)!, focalLengthMm: num(f)!, ...(d && DESIGN_FROM[d] ? { opticalDesign: DESIGN_FROM[d] } : {}) };
  } else telescope = TELESCOPE_CATALOG.find((e) => e.id === t)?.optics;

  const part = <T>(key: string, entries: { id: string; spec: T }[], custom: (fields: string[]) => T): T | undefined => {
    const v = get(key);
    if (!v) return undefined;
    return isCustom(v) ? custom(v.split(",")) : fromCatalog(entries, v);
  };

  const m = get("m");
  const mount: MountSpec | undefined = !m
    ? undefined
    : /^[eadg](,|$)/.test(m)
      ? (() => {
          const [type, payload, goto, tracking] = m.split(",");
          return {
            type: MOUNT_FROM[type],
            ...(num(payload) !== undefined ? { payloadKg: num(payload) } : {}),
            ...(flag(goto) !== undefined ? { goto: flag(goto) } : {}),
            ...(flag(tracking) !== undefined ? { tracking: flag(tracking) } : {}),
          };
        })()
      : fromCatalog(CATALOGS.mount, m);

  const eyepiece = part<EyepieceSpec>("e", CATALOGS.eyepiece, ([fl, afov, barrel, er]) => ({
    focalLengthMm: num(fl)!,
    apparentFovDeg: num(afov)!,
    ...(num(barrel) !== undefined ? { barrelIn: num(barrel) as EyepieceSpec["barrelIn"] } : {}),
    ...(num(er) !== undefined ? { eyeReliefMm: num(er) } : {}),
  }));
  const camera = part<CameraSpec>("c", CATALOGS.camera, ([w, h, px, color]) => ({
    sensorWidthMm: num(w)!,
    sensorHeightMm: num(h)!,
    pixelSizeUm: num(px)!,
    ...(flag(color) !== undefined ? { color: flag(color) } : {}),
  }));
  const barlow = part<BarlowSpec>("b", CATALOGS.barlow, ([factor, barrel]) => ({
    factor: num(factor)!,
    ...(num(barrel) !== undefined ? { barrelIn: num(barrel) as BarlowSpec["barrelIn"] } : {}),
  }));
  const f = get("f");
  const filter: FilterSpec | undefined = !f
    ? undefined
    : (fromCatalog(CATALOGS.filter, f) ??
      ((FILTER_KINDS as readonly string[]).includes(f) ? { name: f.replace(/_/g, " "), kind: f as FilterKind } : undefined));

  const parsed = arSetupSchema.safeParse({
    name: get("n")?.trim() || undefined,
    mode,
    telescope,
    mount,
    eyepiece: mode === "visual" ? eyepiece : undefined,
    camera: mode === "imaging" ? camera : undefined,
    barlow,
    filter,
  });
  return parsed.success ? parsed.data : undefined;
}
