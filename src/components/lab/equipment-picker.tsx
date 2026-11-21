"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { filterTint } from "@/modules/simulations/renderers/filter-tint";
import type { FilterKind, TelescopeOptics } from "@/modules/simulations/engine";
import type { AccessoryKind } from "@/modules/equipment/models";
import { TubeSilhouette } from "./tube-silhouette";

/** What a picker card draws on its left: a scope silhouette, or an icon with the key number. */
export type PickerVisual =
  | { type: "telescope"; optics: TelescopeOptics }
  | { type: "accessory"; kind: AccessoryKind; badge?: string; filterKind?: FilterKind }
  | { type: "none" };

export interface PickerOption {
  id: string;
  title: string;
  /** Maker, or a group hint ("Generic"). */
  eyebrow?: string;
  detail: string;
  visual: PickerVisual;
  /** Section heading inside the dialog. */
  group?: string;
}

const ICON: Record<AccessoryKind, (p: { className?: string }) => React.ReactNode> = {
  eyepiece: Icons.Eyepiece,
  camera: Icons.Camera,
  barlow: Icons.Barlow,
  filter: Icons.Filter,
  mount: Icons.Mount,
};

export function PickerThumb({ visual, size = "md" }: { visual: PickerVisual; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-16 w-20" : size === "sm" ? "h-10 w-11" : "h-12 w-14";
  if (visual.type === "telescope") {
    return <TubeSilhouette optics={visual.optics} className={`${box} shrink-0`} />;
  }
  if (visual.type === "none") {
    return (
      <span className={`${box} flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border-strong text-subtle`}>
        —
      </span>
    );
  }
  const Icon = ICON[visual.kind];
  const tint = visual.kind === "filter" ? filterTint(visual.filterKind) : undefined;
  return (
    <span className={`${box} relative flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-accent/10 text-accent`}>
      {tint ? (
        <span aria-hidden className="size-7 rounded-full border-2 border-[#9aa0ab]" style={{ background: tint }} />
      ) : (
        <Icon className={size === "sm" ? "size-5" : "size-6"} />
      )}
      {visual.badge && <span className={`font-mono leading-none text-foreground ${size === "sm" ? "text-[9px]" : "text-[10px]"}`}>{visual.badge}</span>}
    </span>
  );
}

/**
 * Shows the chosen item as a card; "Change" opens a gallery of real
 * equipment to pick from. Values stay editable in the fields below it.
 */
export function EquipmentPicker({
  label,
  current,
  options,
  selectedId,
  onPick,
  none,
  disabled,
  footer,
  compact = false,
  note,
}: {
  label: string;
  /** The item in use now (may be custom, so not one of the options). */
  current?: Omit<PickerOption, "id" | "group">;
  options: PickerOption[];
  selectedId?: string;
  onPick: (id: string) => void;
  /** Offer a "none" choice with this label. */
  none?: { label: string; onPick: () => void };
  disabled?: boolean;
  footer?: React.ReactNode;
  /** One dense row with the label inside it (for lists of pickers). */
  compact?: boolean;
  /** A short note after the label in compact mode, e.g. "for camera view". */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => `${o.eyebrow ?? ""} ${o.title} ${o.detail}`.toLowerCase().includes(q))
    : options;
  const groups = [...new Set(shown.map((o) => o.group ?? ""))];
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const dialog = (
    <Dialog open={open} onClose={close} title={`Choose ${label.toLowerCase()}`} wide>
      {options.length > 6 && (
        <div className="relative mb-3">
          <Icons.Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, maker or spec"
            aria-label="Search equipment"
            className={`${inputClass} pl-9`}
          />
        </div>
      )}
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {none && !q && (
          <PickerCard
            option={{ id: "", title: none.label, detail: "", visual: { type: "none" } }}
            selected={!current}
            onClick={() => {
              none.onPick();
              close();
            }}
          />
        )}
        {groups.map((g) => (
          <section key={g} aria-label={g || label}>
            {g && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g}</h3>}
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {shown
                .filter((o) => (o.group ?? "") === g)
                .map((o) => (
                  <li key={o.id}>
                    <PickerCard
                      option={o}
                      selected={o.id === selectedId}
                      onClick={() => {
                        onPick(o.id);
                        close();
                      }}
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing matches “{query}”.</p>}
      </div>
      {footer && <div className="mt-4 border-t border-border pt-3 text-xs text-muted">{footer}</div>}
    </Dialog>
  );

  if (compact) {
    const title = current?.title ?? none?.label ?? "None";
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-label={`${label}: ${title}. Change`}
          title={[current?.eyebrow, title, current?.detail].filter(Boolean).join(" · ")}
          className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-sunken/50 px-2 py-1.5 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-border"
        >
          <PickerThumb visual={current?.visual ?? { type: "none" }} size="sm" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-semibold text-foreground">
              {label}
              {note && <span className="font-normal text-subtle"> ({note})</span>}
            </span>
            <span className="block truncate text-[13px] text-foreground/90">{title}</span>
            {current?.detail && <span className="block truncate font-mono text-[10.5px] text-muted">{current.detail}</span>}
          </span>
          {!disabled && <Icons.Chevron className="size-4 shrink-0 text-subtle transition-colors group-hover:text-accent" />}
        </button>
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${current?.title ?? none?.label ?? "none"}. Change`}
        className="group flex w-full items-center gap-3 rounded-lg border border-border bg-surface-sunken/50 p-2 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-border"
      >
        <PickerThumb visual={current?.visual ?? { type: "none" }} />
        <span className="min-w-0 flex-1">
          {current?.eyebrow && <span className="block truncate text-[11px] text-subtle">{current.eyebrow}</span>}
          <span className="block truncate text-sm font-medium">{current?.title ?? none?.label ?? "None"}</span>
          {current?.detail && <span className="block truncate font-mono text-[11px] text-muted">{current.detail}</span>}
        </span>
        {!disabled && <span className="shrink-0 text-xs text-accent group-hover:underline">Change</span>}
      </button>

      {dialog}
    </div>
  );
}

function PickerCard({ option, selected, onClick }: { option: PickerOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-border bg-surface-sunken/50 hover:border-accent"
      }`}
    >
      <PickerThumb visual={option.visual} size="lg" />
      <span className="min-w-0 flex-1">
        {option.eyebrow && <span className="block truncate text-[11px] text-subtle">{option.eyebrow}</span>}
        <span className="block text-sm font-medium">{option.title}</span>
        {option.detail && <span className="block font-mono text-[11px] text-muted">{option.detail}</span>}
      </span>
      {selected && <span className="shrink-0 text-xs text-accent">In use</span>}
    </button>
  );
}
