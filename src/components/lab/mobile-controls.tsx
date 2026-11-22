"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/ui/icons";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { BARLOW_CATALOG, EYEPIECE_CATALOG } from "@/modules/equipment/catalog";
import type { BarlowSpec, EyepieceSpec } from "@/modules/simulations/engine";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import { AccessoryPicker } from "./configuration-panel";

/**
 * Phones and small tablets (below lg): the Lab's controls in a dock pinned
 * above the tab bar. Each button opens a sheet over the lower part of the
 * screen, so a change shows in the view above it straight away, without
 * scrolling between the view and a panel further down the page.
 * Sheet content is only mounted while open, so no control appears twice.
 */
export interface DockItem {
  id: string;
  label: string;
  /** Current value shown under the label, e.g. "10 mm · 150×". */
  value?: string;
  icon: (p: { className?: string }) => React.ReactNode;
  /** Sheet heading; defaults to the label. */
  title?: string;
  content: () => React.ReactNode;
  /** Draws attention (e.g. a warning in the results). */
  alert?: boolean;
}

export function MobileControlDock({ items, label = "Simulation controls" }: { items: DockItem[]; label?: string }) {
  const [open, setOpen] = useState<string>();
  const sheetId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.id === open);
  // Rendered into <body>: a transformed or filtered ancestor would otherwise make
  // "fixed" scroll with the page instead of staying pinned to the screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A sheet for a control that no longer exists (e.g. after switching mode) closes.
  useEffect(() => {
    if (open && !current) setOpen(undefined);
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (id: string) => {
    const next = open === id ? undefined : id;
    setOpen(next);
    if (!next) return;
    // Bring the view to the top of the screen, where the sheet doesn't cover it.
    const view = document.querySelector<HTMLElement>("[data-view-canvas]");
    if (view) {
      // Just under the sticky site header (4 rem).
      const top = view.getBoundingClientRect().top + window.scrollY - 72;
      if (Math.abs(top - window.scrollY) > 24) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    requestAnimationFrame(() => sheet.current?.focus({ preventScroll: true }));
  };

  if (!mounted) return null;
  // One floating panel, inset from the edges and lifted off the tab bar, so it reads as
  // the controls of this view (not a second navigation bar). A control's sheet grows
  // upward out of the same panel.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.1rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-3 lg:hidden">
      <div className="pointer-events-auto mx-auto max-w-xl overflow-hidden rounded-2xl border border-border-strong bg-surface/95 shadow-[0_10px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/40 backdrop-blur-md">
        {current && (
          <div ref={sheet} id={sheetId} role="dialog" aria-label={current.title ?? current.label} tabIndex={-1} className="min-w-0 border-b border-border outline-none">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3">
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{current.title ?? current.label}</h2>
              <button
                type="button"
                onClick={() => setOpen(undefined)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground"
                aria-label="Close"
              >
                <span aria-hidden className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="max-h-[min(36dvh,22rem)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 pt-1 [scrollbar-width:thin]">{current.content()}</div>
          </div>
        )}
        <div role="toolbar" aria-label={label} className="flex gap-1 p-1.5">
          {items.map((item) => {
            const active = item.id === open;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-expanded={active}
                aria-controls={active ? sheetId : undefined}
                onClick={() => toggle(item.id)}
                className={`flex min-w-0 flex-1 flex-col items-center rounded-xl px-1 pb-1.5 pt-1 transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                <span className="flex max-w-full items-center gap-1 text-[10px] uppercase">
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.alert && !active && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />}
                </span>
                <span className={`mt-0.5 w-full truncate text-center text-[13px] font-semibold ${active ? "" : "text-foreground"}`}>{item.value ?? "—"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* --- Choosers: big tap targets, each showing what the choice gives ------- */

const sameSpec = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fmtField = (deg: number) => (deg >= 1 ? `${deg.toFixed(2)}°` : `${Math.round(deg * 60)}′`);

interface EyepieceOption {
  key: string;
  spec: EyepieceSpec;
  name: string;
  group: string;
}

/** Every eyepiece (yours first), as the magnification and field it gives on this telescope. */
export function EyepieceChooser({ config, onChange }: { config: ConfigurationSpec; onChange: (spec: EyepieceSpec) => void }) {
  const owned = useOwnerQuery((r) => r.listAccessories(), []).data ?? [];
  const efl = config.telescope.focalLengthMm * (config.barlow?.factor ?? 1);
  const options: EyepieceOption[] = [
    ...owned.flatMap((a) => (a.kind === "eyepiece" ? [{ key: `mine:${a.id}`, spec: a.spec, name: a.name, group: "My eyepieces" }] : [])),
    ...EYEPIECE_CATALOG.map((e) => ({ key: e.id, spec: e.spec, name: [e.manufacturer, e.model].filter(Boolean).join(" "), group: "Catalogue" })),
  ].sort((a, b) => (a.group === b.group ? b.spec.focalLengthMm - a.spec.focalLengthMm : a.group === "My eyepieces" ? -1 : 1));
  const current = config.eyepiece;
  const mag = (s: EyepieceSpec) => efl / s.focalLengthMm;
  const byPower = [...options].sort((a, b) => mag(a.spec) - mag(b.spec));
  const currentMag = current ? mag(current) : undefined;
  const lower = currentMag === undefined ? undefined : [...byPower].reverse().find((o) => mag(o.spec) < currentMag - 0.5);
  const higher = currentMag === undefined ? undefined : byPower.find((o) => mag(o.spec) > currentMag + 0.5);
  if (!efl || !Number.isFinite(efl)) return <p className="text-sm text-muted">Set the telescope&apos;s focal length first.</p>;

  let lastGroup = "";
  return (
    <div className="space-y-3">
      {currentMag !== undefined && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!lower}
            onClick={() => lower && onChange({ ...lower.spec })}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface-sunken/60 text-sm disabled:opacity-40"
          >
            − Lower{lower ? <span className="font-mono text-xs text-muted">{Math.round(mag(lower.spec))}×</span> : null}
          </button>
          <span className="w-14 shrink-0 text-center font-mono text-lg font-semibold">{Math.round(currentMag)}×</span>
          <button
            type="button"
            disabled={!higher}
            onClick={() => higher && onChange({ ...higher.spec })}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface-sunken/60 text-sm disabled:opacity-40"
          >
            Higher +{higher ? <span className="font-mono text-xs text-muted">{Math.round(mag(higher.spec))}×</span> : null}
          </button>
        </div>
      )}
      <ul className="space-y-1.5">
        {options.map((o) => {
          const selected = current !== undefined && sameSpec(o.spec, current);
          const m = mag(o.spec);
          const heading = o.group !== lastGroup && (owned.some((a) => a.kind === "eyepiece") || o.group !== "Catalogue");
          lastGroup = o.group;
          return (
            <li key={o.key}>
              {heading && <p className="mb-1 mt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">{o.group}</p>}
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...o.spec })}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected ? "border-accent bg-accent/15" : "border-border bg-surface-sunken/40 hover:border-border-strong"
                }`}
              >
                <span className="w-14 shrink-0 font-mono text-base font-semibold">{Math.round(m)}×</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{o.name}</span>
                  <span className="block text-xs text-muted">
                    {o.spec.focalLengthMm} mm · {o.spec.apparentFovDeg}° · field {fmtField(o.spec.apparentFovDeg / m)}
                  </span>
                </span>
                {selected && <Icons.Check className="size-4 shrink-0 text-accent" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** No Barlow, or one of yours or the catalogue's, with the magnification it would give. */
export function BarlowChooser({ config, onChange }: { config: ConfigurationSpec; onChange: (spec: BarlowSpec | undefined) => void }) {
  const owned = useOwnerQuery((r) => r.listAccessories(), []).data ?? [];
  const options = [
    ...owned.flatMap((a) => (a.kind === "barlow" ? [{ key: `mine:${a.id}`, spec: a.spec, name: a.name }] : [])),
    ...BARLOW_CATALOG.map((b) => ({ key: b.id, spec: b.spec, name: [b.manufacturer, b.model].filter(Boolean).join(" ") })),
  ];
  const ep = config.eyepiece?.focalLengthMm;
  const f = config.telescope.focalLengthMm;
  const result = (factor: number) => (ep && f ? `${Math.round((f * factor) / ep)}×` : `f ${Math.round(f * factor)} mm`);
  const row = (key: string, selected: boolean, onClick: () => void, title: string, detail: string, badge: string) => (
    <li key={key}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          selected ? "border-accent bg-accent/15" : "border-border bg-surface-sunken/40 hover:border-border-strong"
        }`}
      >
        <span className="w-14 shrink-0 font-mono text-base font-semibold">{badge}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{title}</span>
          <span className="block text-xs text-muted">{detail}</span>
        </span>
        {selected && <Icons.Check className="size-4 shrink-0 text-accent" />}
      </button>
    </li>
  );
  return (
    <ul className="space-y-1.5">
      {row("none", !config.barlow, () => onChange(undefined), "No Barlow", `Gives ${result(1)}`, "1×")}
      {options.map((o) =>
        row(o.key, config.barlow !== undefined && sameSpec(o.spec, config.barlow), () => onChange({ ...o.spec }), o.name, `Gives ${result(o.spec.factor)}`, `${o.spec.factor}×`),
      )}
    </ul>
  );
}

/** The camera (or filter…) picker, with your own accessories listed first. */
export function AccessorySheetPicker({ kind, config, set }: { kind: "camera" | "filter"; config: ConfigurationSpec; set: (patch: Partial<ConfigurationSpec>) => void }) {
  const owned = useOwnerQuery((r) => r.listAccessories(), []).data ?? [];
  return <AccessoryPicker kind={kind} config={config} owned={owned} set={set} />;
}
