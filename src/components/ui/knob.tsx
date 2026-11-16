"use client";

import { useId, useRef } from "react";

/**
 * A rotary control, like a focus knob or an adjustment bolt. Drag up/down
 * (or left/right) to turn it; arrow keys step, Page Up/Down step ×10.
 * Exposed to assistive technology as a slider.
 */
export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  /** Value change per pixel dragged; defaults to the full range over 240 px. */
  sensitivity,
  /** Turns of the dial across the whole range (a focuser knob turns many times). */
  turns = 0.8,
  hint,
  size = 68,
  tone = "default",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  sensitivity?: number;
  turns?: number;
  hint?: string;
  size?: number;
  tone?: "default" | "good" | "warn";
}) {
  const id = useId();
  const drag = useRef<{ x: number; y: number; v: number } | null>(null);
  const perPx = sensitivity ?? (max - min) / 240;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const frac = (value - min) / (max - min || 1);
  const angle = (frac - 0.5) * turns * 360;
  const ring = tone === "good" ? "stroke-success" : tone === "warn" ? "stroke-warning" : "stroke-accent";

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={id}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={format(value)}
        className="cursor-grab touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const delta = e.clientX - d.x - (e.clientY - d.y);
          onChange(clamp(d.v + delta * perPx));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const big = step * 10;
          const next =
            e.key === "ArrowUp" || e.key === "ArrowRight"
              ? value + step
              : e.key === "ArrowDown" || e.key === "ArrowLeft"
                ? value - step
                : e.key === "PageUp"
                  ? value + big
                  : e.key === "PageDown"
                    ? value - big
                    : e.key === "Home"
                      ? min
                      : e.key === "End"
                        ? max
                        : undefined;
          if (next === undefined) return;
          e.preventDefault();
          onChange(clamp(next));
        }}
      >
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
          <circle cx="32" cy="32" r="29" className={`fill-none ${ring}`} strokeWidth="2" strokeOpacity="0.55" />
          <g transform={`rotate(${angle} 32 32)`}>
            <circle cx="32" cy="32" r="24" className="fill-surface-raised stroke-border-strong" strokeWidth="1" />
            {Array.from({ length: 18 }, (_, i) => (
              <line
                key={i}
                x1="32"
                y1="9"
                x2="32"
                y2="12.5"
                transform={`rotate(${i * 20} 32 32)`}
                className="stroke-border-strong"
                strokeWidth="1.6"
              />
            ))}
            <line x1="32" y1="12" x2="32" y2="24" className="stroke-accent" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      </div>
      <span id={id} className="text-xs font-medium">
        {label}
      </span>
      <span className="font-mono text-[11px] text-muted">{format(value)}</span>
      {hint && <span className="max-w-[9rem] text-[10px] leading-tight text-subtle">{hint}</span>}
    </div>
  );
}
