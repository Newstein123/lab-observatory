"use client";

import { Icons } from "@/components/ui/icons";

/**
 * Identify · Pin · Labels · Explore — the observation interaction toolbar,
 * inside the view card next to the eyepiece/camera switch.
 */
export function ObservationToolbar({
  identify,
  onIdentifyChange,
  canPin,
  pinned,
  onPin,
  labels,
  onLabelsChange,
  labelsAvailable,
  explorerOpen,
  onExplore,
  discoveries,
}: {
  identify: boolean;
  onIdentifyChange: (v: boolean) => void;
  canPin: boolean;
  pinned: boolean;
  onPin: () => void;
  labels: boolean;
  onLabelsChange: (v: boolean) => void;
  labelsAvailable: boolean;
  explorerOpen: boolean;
  onExplore: () => void;
  /** The fifth tool: saved discoveries and history for this target. */
  discoveries?: (buttonClass: string) => React.ReactNode;
}) {
  // Names collapse to icons (still the accessible name) where the view card is narrow.
  const label = "max-[1899px]:sr-only";
  const btn = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "bg-accent/25 text-foreground ring-1 ring-accent/60" : "text-muted hover:bg-white/5 hover:text-foreground"
    }`;
  return (
    <div role="toolbar" aria-label="Observation tools" className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface-sunken/80 p-0.5">
      <button
        type="button"
        aria-pressed={identify}
        onClick={() => onIdentifyChange(!identify)}
        className={btn(identify)}
        title="Identify: click anything in the view to find out what it is"
      >
        <Icons.Crosshair className="size-4" />
        <span className={label}>Identify</span>
      </button>
      <button type="button" aria-pressed={pinned} disabled={!canPin} onClick={onPin} className={btn(pinned)} title={pinned ? "Unpin" : "Pin the selected object or feature"}>
        <Icons.Pin className="size-4" />
        <span className={label}>{pinned ? "Pinned" : "Pin"}</span>
      </button>
      <button
        type="button"
        aria-pressed={labels}
        disabled={!labelsAvailable}
        onClick={() => onLabelsChange(!labels)}
        className={btn(labels && labelsAvailable)}
        title={labelsAvailable ? "Show the names of identified features" : "No surface features to label for this target"}
      >
        <Icons.Layers className="size-4" />
        <span className={label}>Labels</span>
      </button>
      <button type="button" aria-pressed={explorerOpen} onClick={onExplore} className={btn(explorerOpen)} title="Open the Object Explorer">
        <Icons.Sparkles className="size-4" />
        <span className={label}>Explore</span>
      </button>
      {discoveries?.(btn(false))}
    </div>
  );
}
