"use client";

/** Small visual readouts shared by the workbench and the interactive AR view. */

/** What a star looks like at the current focus: a point when sharp, a disc (a ring for reflectors) when not. */
export function StarTest({ errorMm, obstructed }: { errorMm: number; obstructed: boolean }) {
  const r = Math.min(46, 1.6 + Math.abs(errorMm) * 1.9);
  const glow = Math.max(0.12, Math.min(1, 9 / (r * r)));
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 110 110" className="size-[110px] rounded-full bg-black" role="img" aria-label={r < 3 ? "A sharp star" : "A blurred star"}>
        <defs>
          <radialGradient id="star-core">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#dfe6ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {r < 3 ? (
          <>
            <circle cx="55" cy="55" r="6" fill="url(#star-core)" />
            <circle cx="55" cy="55" r="5.5" fill="none" stroke="#dfe6ff" strokeOpacity="0.25" strokeWidth="0.8" />
          </>
        ) : (
          <>
            <circle cx="55" cy="55" r={r} fill="#dfe6ff" fillOpacity={glow} />
            <circle cx="55" cy="55" r={r} fill="none" stroke="#fff" strokeOpacity={Math.min(0.8, glow * 2.2)} strokeWidth="1.2" />
            {obstructed && <circle cx="55" cy="55" r={r * 0.36} fill="#000" />}
          </>
        )}
      </svg>
      <figcaption className="text-[11px] text-subtle">Star test</figcaption>
    </figure>
  );
}

export function BalanceBar({ ratio }: { ratio: number }) {
  // −1 (weight-heavy) … +1 (tube-heavy), log scale so small errors still show.
  const x = Math.max(-1, Math.min(1, Math.log2(ratio) * 2.5));
  return (
    <div className="space-y-1" aria-hidden>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-warning/50 via-success/60 to-warning/50">
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground" style={{ left: `${50 + x * 50}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-subtle">
        <span>Weight-heavy</span>
        <span>Balanced</span>
        <span>Tube-heavy</span>
      </div>
    </div>
  );
}
