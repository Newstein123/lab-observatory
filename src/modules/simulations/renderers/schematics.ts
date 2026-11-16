import type { CuratedTarget } from "@/modules/targets/catalogue";
import { gaussian, mulberry32 } from "./random";

/**
 * Illustrative target schematics.
 *
 * These are deliberately simple shapes with correct angular extent. They add
 * NO surface detail (no craters, cloud bands or dust lanes) because inventing
 * detail would misrepresent what is observed (spec §7). They are placeholders
 * until validated reference imagery is integrated.
 */

export interface SchematicStyle {
  /** False renders in greyscale, as the dark-adapted eye perceives faint objects. */
  color: boolean;
}

/** Draw the target centred at (0, 0). Sizes are in canvas pixels. */
export function drawTargetSchematic(
  ctx: CanvasRenderingContext2D,
  target: CuratedTarget,
  majorPx: number,
  minorPx: number,
  { color }: SchematicStyle,
): void {
  const a = Math.max(majorPx / 2, 0.75);
  const b = Math.max(minorPx / 2, 0.75);

  switch (target.id) {
    case "saturn":
      return drawSaturn(ctx, a, b, color);
    default:
      break;
  }

  switch (target.category) {
    case "moon":
      return drawDisc(ctx, a, b, color ? ["#e9e6dc", "#b9b5a8"] : ["#e6e6e6", "#b4b4b4"]);
    case "planet":
      return drawDisc(ctx, a, b, color ? ["#efdcbc", "#b99a72"] : ["#e2e2e2", "#a8a8a8"]);
    case "nebula":
      return drawDiffuse(ctx, a, b, target.angularSize.positionAngleDeg ?? 0, color
        ? [[0, "rgba(255,210,220,1)"], [0.25, "rgba(225,110,150,0.75)"], [0.6, "rgba(120,90,170,0.3)"], [1, "rgba(60,60,120,0)"]]
        : [[0, "rgba(235,235,235,1)"], [0.25, "rgba(170,170,170,0.6)"], [0.6, "rgba(110,110,110,0.2)"], [1, "rgba(80,80,80,0)"]]);
    case "cluster":
      return drawCluster(ctx, target, a, b, color);
    case "galaxy":
      return drawDiffuse(ctx, a, b, target.angularSize.positionAngleDeg ?? 0, color
        ? [[0, "rgba(255,240,215,1)"], [0.08, "rgba(245,220,180,0.85)"], [0.35, "rgba(170,175,210,0.35)"], [1, "rgba(120,130,190,0)"]]
        : [[0, "rgba(240,240,240,1)"], [0.08, "rgba(200,200,200,0.7)"], [0.35, "rgba(120,120,120,0.18)"], [1, "rgba(80,80,80,0)"]]);
  }
}

function drawDisc(ctx: CanvasRenderingContext2D, a: number, b: number, [inner, outer]: [string, string]) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a);
  g.addColorStop(0, inner);
  g.addColorStop(0.75, inner);
  g.addColorStop(1, outer); // gentle limb darkening
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Saturn: ring-system width is the target's major axis. The globe's
 * equatorial diameter is ~1/2.27 of the outer ring diameter. Ring opening
 * (tilt) varies over a 29.5-year cycle; a fixed illustrative opening is used.
 */
function drawSaturn(ctx: CanvasRenderingContext2D, ringA: number, globeB: number, color: boolean) {
  const globeA = ringA / 2.27;
  const ringB = ringA * 0.2;
  const ringColor = color ? "rgba(220,200,160,0.9)" : "rgba(200,200,200,0.9)";
  const ringWidth = Math.max(0.6, ringA * 0.18);
  const ring = (start: number, end: number) => {
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringA - ringWidth / 2, ringB, 0, start, end);
    ctx.stroke();
  };
  ring(Math.PI, Math.PI * 2); // far half, behind the globe
  drawDisc(ctx, globeA, globeB / 2, color ? ["#ead7ac", "#b89f6e"] : ["#dedede", "#a4a4a4"]);
  ring(0, Math.PI); // near half, in front
}

function drawDiffuse(
  ctx: CanvasRenderingContext2D,
  a: number,
  b: number,
  positionAngleDeg: number,
  stops: [number, string][],
) {
  ctx.save();
  ctx.rotate((-positionAngleDeg * Math.PI) / 180);
  ctx.scale(1, b / a);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a);
  for (const [offset, c] of stops) g.addColorStop(offset, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, a, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Star cluster: seeded random stars within the catalogued extent. Globular
 * clusters are centrally concentrated; open clusters are loose. Positions
 * are illustrative, not the real stars.
 */
function drawCluster(ctx: CanvasRenderingContext2D, target: CuratedTarget, a: number, b: number, color: boolean) {
  const globular = /globular/i.test(target.subtype);
  let seed = 0;
  for (const ch of target.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = mulberry32(seed);
  const count = globular ? 260 : 90;
  if (globular) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a * 0.6);
    g.addColorStop(0, color ? "rgba(255,240,210,0.55)" : "rgba(235,235,235,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < count; i++) {
    const r = globular ? Math.min(1, Math.abs(gaussian(rand)) * 0.35) : Math.sqrt(rand());
    const t = rand() * Math.PI * 2;
    const x = Math.cos(t) * r * a;
    const y = Math.sin(t) * r * b;
    // Stars are point sources: a few pixels at any magnification (blur is added by the caller).
    const size = 0.7 + rand() ** 4 * (globular ? 1.2 : 2.2);
    const hot = rand() > 0.6;
    ctx.fillStyle = !color ? "#f2f2f2" : hot ? "#cfdcff" : "#ffe8c8";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}
