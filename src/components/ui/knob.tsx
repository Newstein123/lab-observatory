"use client";

import { useEffect, useId, useRef } from "react";

/**
 * A rotary control, like a focus knob or an adjustment bolt. Grab it and turn
 * it: the dial follows the pointer round its centre (clockwise increases).
 * Hold Shift to turn finely. The mouse wheel and arrow keys step, Page Up/Down
 * step ×10. Exposed to assistive technology as a slider.
 */
export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  /** Turns of the dial across the whole range: more turns, finer control (a focuser knob turns many times). */
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
  turns?: number;
  hint?: string;
  size?: number;
  tone?: "default" | "good" | "warn";
}) {
  const id = useId();
  const el = useRef<HTMLDivElement>(null);
  // While turning: the dial's centre, the pointer's last angle and the exact (unrounded) value.
  const drag = useRef<{ cx: number; cy: number; last: number; acc: number } | null>(null);
  const perDeg = (max - min) / (turns * 360);
  const limit = (v: number) => Math.min(max, Math.max(min, v));
  const clamp = (v: number) => limit(Math.round(v / step) * step);
  // Keep the latest value and handler for the native wheel listener.
  const latest = useRef({ value, onChange, clamp });
  latest.current = { value, onChange, clamp };

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    // Native, so the page doesn't scroll while the wheel turns the dial.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const { value: v, onChange: change, clamp: c } = latest.current;
      change(c(v + (e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [step]);

  const angleAt = (d: { cx: number; cy: number }, e: React.PointerEvent) => (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
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
        title="Drag round the dial to turn it · Shift: fine · wheel or arrow keys: step"
        className="cursor-grab touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        style={{ width: size, height: size }}
        ref={el}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          const d = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, last: 0, acc: value };
          d.last = angleAt(d, e);
          drag.current = d;
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          // Too close to the centre the angle jumps about: wait until the pointer is further out.
          if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < size * 0.12) return;
          const a = angleAt(d, e);
          let turn = a - d.last;
          if (turn > 180) turn -= 360;
          if (turn < -180) turn += 360;
          d.last = a;
          // Past either end the extra turn is dropped, so turning back responds at once.
          d.acc = limit(d.acc + turn * perDeg * (e.shiftKey ? 0.2 : 1));
          const next = clamp(d.acc);
          if (next !== value) onChange(next);
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
