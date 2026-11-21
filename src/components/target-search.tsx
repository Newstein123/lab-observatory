"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { TargetGlyph } from "@/components/lab/target-glyph";
import { TARGETS } from "@/modules/targets/catalogue";

/**
 * Find a target by name, catalogue number or kind and open it in the
 * simulator. ⌘K / Ctrl+K focuses it from anywhere.
 */
export function TargetSearch() {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return TARGETS.filter((t) => `${t.name} ${t.designation ?? ""} ${t.subtype} ${t.category}`.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  const go = (targetId: string) => {
    router.push(`/lab/simulate?target=${targetId}`);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative w-full max-w-sm">
      <Icons.Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={input}
        role="combobox"
        aria-label="Search targets"
        aria-expanded={open && results.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && results[active] ? `${id}-${results[active].id}` : undefined}
        autoComplete="off"
        placeholder="Search targets, objects or catalogues…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && results[active]) {
            go(results[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
        }}
        className="h-9 w-full rounded-lg border border-border bg-surface-sunken/70 pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-accent"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 font-mono text-[10px] text-muted">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
      {open && results.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised p-1 shadow-xl">
          {results.map((t, i) => (
            <li key={t.id} id={`${id}-${t.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm ${i === active ? "bg-accent/15" : ""}`}
              >
                <TargetGlyph target={t} size={22} />
                <span className="min-w-0 flex-1 truncate">
                  {t.designation && <span className="font-medium">{t.designation} </span>}
                  {t.name}
                </span>
                <span className="shrink-0 text-[11px] text-muted">{t.subtype}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
