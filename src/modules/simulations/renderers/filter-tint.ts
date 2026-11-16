import type { FilterKind } from "@/modules/simulations/engine";

/**
 * Colour cast for coloured and line filters (ILLUSTRATIVE). Applied with a
 * "multiply" composite over the target. Neutral filters only dim.
 */
const TINTS: Partial<Record<FilterKind, string>> = {
  color_blue: "#7d95ff",
  color_orange: "#ffb070",
  oiii: "#86ffd6",
  uhc: "#b8f2ea",
  light_pollution: "#ffe9d0",
};

export function filterTint(kind: FilterKind | undefined): string | undefined {
  return kind ? TINTS[kind] : undefined;
}

/** Multiply a tint over everything already drawn in the current clip. */
export function applyTint(ctx: CanvasRenderingContext2D, tint: string | undefined, w: number, h: number) {
  if (!tint) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
