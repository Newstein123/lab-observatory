"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import { canPersist, signInHref, useAuth } from "@/modules/auth/use-auth";
import { displayFilter, type Orientation, type ViewDisplay, type ViewLayers } from "./view-options";

const toolButton =
  "group relative flex size-9 items-center justify-center rounded-lg border border-border bg-black/60 text-muted backdrop-blur transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-expanded:border-accent aria-expanded:text-foreground";

/** A tooltip shown on hover and keyboard focus (the button's name is its aria-label). */
function Tip({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-nowrap rounded-md bg-surface-raised px-2 py-1 text-[11px] text-foreground shadow-lg ring-1 ring-border group-hover:block group-focus-visible:block"
    >
      {text}
    </span>
  );
}

/** Closes a popover on outside click or Esc. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Popover({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-label={title} className="absolute bottom-full right-0 z-30 mb-2 max-h-[min(70vh,28rem)] w-64 overflow-y-auto rounded-xl border border-border bg-surface-raised p-3 text-sm shadow-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Check({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-start gap-2 rounded-md px-1 py-1.5 ${disabled ? "opacity-50" : "hover:bg-surface-sunken/60"}`}>
      <input type="checkbox" className="mt-0.5 accent-accent" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-xs text-muted">
        {label}
        <span className="font-mono text-foreground">{Math.round(value * 100)}%</span>
      </span>
      <input type="range" min={0.5} max={2} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-border p-0.5 text-xs">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-md px-1.5 py-1 ${value === v ? "bg-accent-strong text-accent-foreground" : "text-muted hover:text-foreground"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The view's four tools: re-centre the target, snapshot, overlay layers and
 * display settings. Each changes the actual view.
 */
export function ViewTools({
  centred,
  onCentre,
  onSnapshot,
  layers,
  setLayers,
  display,
  setDisplay,
  canGrid,
  otherFieldLabel,
}: {
  centred: boolean;
  onCentre: () => void;
  onSnapshot: () => void;
  layers: ViewLayers;
  setLayers: (p: Partial<ViewLayers>) => void;
  display: ViewDisplay;
  setDisplay: (p: Partial<ViewDisplay>) => void;
  /** Whether the target's position is known (for the RA/Dec grid). */
  canGrid: boolean;
  /** e.g. "Camera frame"; undefined when the other instrument isn't configured. */
  otherFieldLabel?: string;
}) {
  const layersPop = usePopover();
  const settingsPop = usePopover();
  const changed = display.brightness !== 1 || display.contrast !== 1 || display.colour !== "natural" || display.orientation !== "sky" || !display.seeing;
  return (
    <>
      <button type="button" className={toolButton} aria-label="Centre the target" disabled={centred} onClick={onCentre}>
        <Icons.Crosshair className="size-[18px]" />
        <Tip text={centred ? "Target centred · drag the view to move the telescope" : "Centre the target"} />
      </button>
      <button type="button" className={toolButton} aria-label="Snapshot" onClick={onSnapshot}>
        <Icons.Image className="size-[18px]" />
        <Tip text="Snapshot: save or download this view" />
      </button>
      <div ref={layersPop.ref} className="relative">
        <button type="button" className={toolButton} aria-label="Layers" aria-expanded={layersPop.open} onClick={() => layersPop.setOpen((o) => !o)}>
          <Icons.Layers className="size-[18px]" />
          {!layersPop.open && <Tip text="Layers: labels, grid, compass…" />}
        </button>
        {layersPop.open && (
          <Popover title="Layers">
            <Check label="Labels" hint="Target and moon names" checked={layers.labels} onChange={(v) => setLayers({ labels: v })} />
            <Check label="Scale bar" checked={layers.scale} onChange={(v) => setLayers({ scale: v })} />
            <Check label="Compass" hint="Where north and east are in this view" checked={layers.compass} onChange={(v) => setLayers({ compass: v })} />
            <Check
              label="RA/Dec grid"
              hint={canGrid ? "Sky coordinates of date, from the target's position" : "Position unknown for this target"}
              checked={layers.grid}
              disabled={!canGrid}
              onChange={(v) => setLayers({ grid: v })}
            />
            <Check
              label={otherFieldLabel ?? "Other instrument's field"}
              hint={otherFieldLabel ? "Outline of the other mode's field, centred" : "Add the other instrument to compare fields"}
              checked={layers.otherField && Boolean(otherFieldLabel)}
              disabled={!otherFieldLabel}
              onChange={(v) => setLayers({ otherField: v })}
            />
          </Popover>
        )}
      </div>
      <div ref={settingsPop.ref} className="relative">
        <button type="button" className={toolButton} aria-label="View settings" aria-expanded={settingsPop.open} onClick={() => settingsPop.setOpen((o) => !o)}>
          <Icons.Sliders className="size-[18px]" />
          {changed && <span aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />}
          {!settingsPop.open && <Tip text="View settings: brightness, colour, orientation…" />}
        </button>
        {settingsPop.open && (
          <Popover title="View settings">
            <div className="space-y-3">
              <Slider label="Brightness (display)" value={display.brightness} onChange={(v) => setDisplay({ brightness: v })} />
              <Slider label="Contrast (display)" value={display.contrast} onChange={(v) => setDisplay({ contrast: v })} />
              <Segmented label="Colour" value={display.colour} onChange={(v) => setDisplay({ colour: v })} options={[["natural", "Natural"], ["red", "Night red"], ["mono", "Mono"]]} />
              <Segmented<Orientation>
                label="Orientation"
                value={display.orientation}
                onChange={(v) => setDisplay({ orientation: v })}
                options={[["sky", "As the sky"], ["diagonal", "Diagonal"], ["inverted", "Straight"]]}
              />
              <p className="-mt-2 text-[11px] text-muted">
                {display.orientation === "sky"
                  ? "North up, east left, as on a star chart."
                  : display.orientation === "diagonal"
                    ? "Mirrored, as through a star diagonal (refractors, SCTs)."
                    : "Upside down, as straight through (Newtonians, finders)."}
              </p>
              <Check
                label="Atmospheric seeing"
                hint={display.seeing ? "Blur from the sky conditions is included" : "Off: optics only, as above the atmosphere"}
                checked={display.seeing}
                onChange={(v) => setDisplay({ seeing: v })}
              />
              <button
                type="button"
                className="text-xs text-accent hover:underline disabled:text-subtle disabled:no-underline"
                disabled={!changed}
                onClick={() => setDisplay({ brightness: 1, contrast: 1, colour: "natural", orientation: "sky", seeing: true })}
              >
                Reset to defaults
              </button>
            </div>
          </Popover>
        )}
      </div>
    </>
  );
}

/** Draw the current view (with its display settings and overlays) and a caption into one PNG. */
async function composeSnapshot(root: ParentNode, display: ViewDisplay, caption: string[]): Promise<string | undefined> {
  const view = root.querySelector<HTMLCanvasElement>("[data-view-canvas]");
  if (!view) return undefined;
  const scale = view.width / (view.clientWidth || view.width);
  const band = Math.round((18 + caption.length * 18) * scale);
  const out = document.createElement("canvas");
  out.width = view.width;
  out.height = view.height + band;
  const ctx = out.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.save();
  ctx.filter = displayFilter(display);
  ctx.translate(view.width / 2, view.height / 2);
  if (display.orientation === "diagonal") ctx.scale(-1, 1);
  if (display.orientation === "inverted") ctx.rotate(Math.PI);
  ctx.drawImage(view, -view.width / 2, -view.height / 2);
  ctx.restore();
  const svg = root.querySelector<SVGSVGElement>("[data-view-overlay]");
  if (svg) {
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, view.width, view.height);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
    URL.revokeObjectURL(url);
  }
  ctx.fillStyle = "#e8ebf7";
  caption.forEach((line, i) => {
    ctx.font = `${i === 0 ? "600 " : ""}${Math.round(13 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = i === 0 ? "#e8ebf7" : "#8a93b5";
    ctx.fillText(line, 12 * scale, view.height + (16 + i * 18) * scale);
  });
  return out.toDataURL("image/png");
}

/** The snapshot dialog: the view as an image, what it records, download or save. */
export function SnapshotDialog({
  open,
  onClose,
  display,
  caption,
  fileName,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  display: ViewDisplay;
  /** First line: title; the rest: details. */
  caption: string[];
  fileName: string;
  onSave: () => Promise<{ id: string }>;
}) {
  const auth = useAuth();
  const [image, setImage] = useState<string>();
  const [saved, setSaved] = useState<{ id: string } | "busy" | { error: string }>();
  useEffect(() => {
    if (!open) return;
    setSaved(undefined);
    setImage(undefined);
    let live = true;
    composeSnapshot(document, display, caption).then((url) => live && setImage(url));
    return () => {
      live = false;
    };
    // Compose once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `${fileName}.png`;
    a.click();
  };
  const save = async () => {
    setSaved("busy");
    try {
      setSaved(await onSave());
    } catch (e) {
      setSaved({ error: e instanceof Error ? e.message : "Couldn't save." });
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Snapshot" wide>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-h-48 items-center justify-center rounded-lg bg-black">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={`Snapshot: ${caption[0]}`} className="max-h-[60vh] w-auto rounded-lg" />
          ) : (
            <p className="text-sm text-muted">Capturing…</p>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <dl className="space-y-1.5 text-xs">
            {caption.map((line, i) => (
              <dd key={i} className={i === 0 ? "text-sm font-medium" : "text-muted"}>
                {line}
              </dd>
            ))}
          </dl>
          <Button className="w-full" onClick={download} disabled={!image}>
            <Icons.Download className="size-4" />
            Download PNG
          </Button>
          {canPersist(auth) ? (
            saved && typeof saved === "object" && "id" in saved ? (
              <p role="status" className="text-xs text-success">
                Saved to My Observatory.{" "}
                <Link href={`/observatory/simulations/${saved.id}`} className="underline">
                  Open it
                </Link>
              </p>
            ) : (
              <>
                <Button variant="primary" className="w-full" onClick={save} disabled={saved === "busy"}>
                  <Icons.Bookmark className="size-4" />
                  Save to My Observatory
                </Button>
                {saved && typeof saved === "object" && "error" in saved && <p className="text-xs text-danger">{saved.error}</p>}
                <p className="text-[11px] text-subtle">Saves the simulation: setup, target, place, time and conditions. It reopens exactly as now.</p>
              </>
            )
          ) : auth.mode === "supabase" ? (
            <Link href={signInHref()} className={buttonStyles({ className: "w-full" })}>
              Sign in to save
            </Link>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

