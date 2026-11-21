import { Icons } from "@/components/ui/icons";
import type { CuratedTarget } from "@/modules/targets/catalogue";

/** Planet colours for bodies without a small photo (lit from the upper left). */
const DISC: Record<string, [string, string]> = {
  mercury: ["#c9c2b8", "#6d665f"],
  venus: ["#f6e7c1", "#b9975b"],
  mars: ["#f0a072", "#93381f"],
  jupiter: ["#f1dcc0", "#9c7350"],
  saturn: ["#f3e1b0", "#a8864c"],
  uranus: ["#c9f1f4", "#5aa9b8"],
  neptune: ["#8fb2ff", "#2c4fbf"],
  moon: ["#e6e6e6", "#6f6f6f"],
};

const CATEGORY_ICON = {
  galaxy: Icons.Galaxy,
  nebula: Icons.Nebula,
  cluster: Icons.Sparkles,
} as const;

/**
 * A small decorative picture of a target: the Moon's photo, a shaded disc for
 * a planet (with rings for Saturn), or an icon for deep-sky objects.
 */
export function TargetGlyph({ target, size = 20, className = "" }: { target: CuratedTarget; size?: number; className?: string }) {
  if (target.id === "moon") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/reference/moon.webp" alt="" aria-hidden width={size} height={size} loading="lazy" className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
    );
  }
  const disc = DISC[target.id];
  if (disc) {
    const ball = (
      <span
        aria-hidden
        className="block rounded-full"
        style={{
          width: target.id === "saturn" ? size * 0.62 : size,
          height: target.id === "saturn" ? size * 0.62 : size,
          background: `radial-gradient(circle at 32% 30%, ${disc[0]}, ${disc[1]} 75%, #000 115%)`,
        }}
      />
    );
    if (target.id !== "saturn") return <span className={`shrink-0 ${className}`}>{ball}</span>;
    return (
      <span aria-hidden className={`relative flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
        {ball}
        <span className="absolute left-0 top-1/2 h-[30%] w-full -translate-y-1/2 -rotate-[18deg] rounded-[50%] border-[1.5px] border-[#d8c48e]/80" />
      </span>
    );
  }
  const Icon = CATEGORY_ICON[target.category as keyof typeof CATEGORY_ICON] ?? Icons.Star;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent ${className}`} style={{ width: size, height: size }}>
      <Icon className="size-[70%]" />
    </span>
  );
}
