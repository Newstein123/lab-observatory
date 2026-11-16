"use client";

import { useId, useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  count?: number;
}

interface TabsProps<T extends string> {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** "underline" for page sections, "segmented" for compact toggles. */
  variant?: "underline" | "segmented";
  className?: string;
}

/**
 * Accessible tab list (arrow keys move between tabs). Pair each panel with
 * `tabPanelProps(tabsId, id)`.
 */
export function Tabs<T extends string>({ label, items, value, onChange, variant = "underline", className = "" }: TabsProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const baseId = useId();

  function onKeyDown(e: React.KeyboardEvent) {
    const i = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }

  const segmented = variant === "segmented";
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={
        segmented
          ? `inline-flex rounded-lg border border-border bg-surface-sunken/80 p-1 ${className}`
          : `flex gap-1 overflow-x-auto border-b border-border ${className}`
      }
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            id={`${baseId}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={
              segmented
                ? `rounded-md px-3.5 py-1.5 text-sm transition-colors ${
                    active ? "bg-accent-strong text-accent-foreground shadow-glow" : "text-muted hover:text-foreground"
                  }`
                : `-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                    active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
                  }`
            }
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 font-mono text-xs text-muted">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
