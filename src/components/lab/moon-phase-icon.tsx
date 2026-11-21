import { limbRotation, litOutline } from "@/modules/simulations/renderers/phase-mask";

/** The Moon's phase as a small disc, lit side turned the way it faces. */
export function MoonPhaseIcon({ illuminated, brightLimbDeg, size = 36, label }: { illuminated: number; brightLimbDeg: number; size?: number; label?: string }) {
  const r = size / 2 - 1;
  const d = litOutline(illuminated, 40)
    .map(([x, y], i) => `${i ? "L" : "M"}${(x * r).toFixed(2)},${(y * r).toFixed(2)}`)
    .join(" ");
  const rot = (limbRotation(brightLimbDeg) * 180) / Math.PI;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} role="img" aria-label={label ?? `Moon ${Math.round(illuminated * 100)}% lit`} className="shrink-0">
      <circle r={r} fill="#1b1f2b" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <path d={`${d} Z`} transform={`rotate(${rot.toFixed(1)})`} fill="#e9e5d6" />
    </svg>
  );
}
