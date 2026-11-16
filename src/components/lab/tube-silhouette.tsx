import { tubeStyle } from "@/components/equipment-3d/dimensions";
import type { TelescopeOptics } from "@/modules/simulations/engine";

/**
 * Lightweight vector rendering of a telescope for lists and cards, so a
 * catalogue page doesn't need a WebGL context per item. Proportions follow
 * the optics (tube length vs aperture).
 */
export function TubeSilhouette({ optics, className = "h-24 w-full" }: { optics: TelescopeOptics; className?: string }) {
  const style = tubeStyle(optics);
  const ratio =
    style === "refractor"
      ? Math.max(optics.focalLengthMm * 0.8, optics.apertureMm * 3) / optics.apertureMm + 1
      : style === "newtonian"
        ? Math.max(optics.focalLengthMm * 0.96, optics.apertureMm * 3) / optics.apertureMm
        : style === "maksutov"
          ? 2.5
          : 2.15;
  const len = Math.min(118, 26 * Math.min(ratio, 9) ** 0.75);
  const w = Math.min(34, Math.max(12, len / ratio + 6));
  const light = style === "refractor" || style === "newtonian";
  const id = `tube-${style}`;
  return (
    <svg viewBox="0 0 160 110" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light ? "#f4f5f8" : "#3b4152"} />
          <stop offset="0.55" stopColor={light ? "#c9ccd6" : "#1d212b"} />
          <stop offset="1" stopColor={light ? "#8d92a0" : "#0f1117"} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.9" r="0.6">
          <stop offset="0" stopColor="#6c7bff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6c7bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="100" rx="60" ry="8" fill={`url(#${id}-glow)`} />
      {/* tripod */}
      <g stroke="#7d8496" strokeWidth="2.2" strokeLinecap="round">
        <line x1="80" y1="62" x2="56" y2="100" />
        <line x1="80" y1="62" x2="104" y2="100" />
        <line x1="80" y1="62" x2="80" y2="102" />
      </g>
      <rect x="74" y="56" width="12" height="9" rx="2" fill="#2a2e38" />
      {/* tube, tilted up */}
      <g transform={`translate(80 54) rotate(-32)`}>
        <rect x={-len * 0.45} y={-w / 2} width={len} height={w} rx={style === "sct" || style === "maksutov" ? 4 : 2} fill={`url(#${id}-body)`} />
        {style === "refractor" && <rect x={len * 0.55 - len * 0.22} y={-w / 2 - 2} width={len * 0.22} height={w + 4} rx="2" fill={`url(#${id}-body)`} />}
        {style === "newtonian" && <rect x={len * 0.35} y={-w / 2 - 7} width="6" height="7" fill="#22252d" />}
        {(style === "sct" || style === "maksutov") && <rect x={len * 0.55 - 5} y={-w / 2 - 1} width="5" height={w + 2} rx="1" fill="#9aa0ab" />}
        <rect x={-len * 0.45 - 6} y={-4} width="6" height="8" fill="#22252d" />
        <rect x={-len * 0.1} y={w / 2} width={len * 0.4} height="3" fill="#2a2e38" />
      </g>
    </svg>
  );
}
