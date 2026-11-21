"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { useExploreHistory } from "@/modules/discoveries/history";
import type { Discovery } from "@/modules/discoveries/models";
import type { ExplorerSelection } from "@/modules/explorer/types";

/**
 * Toolbar button: what you have saved and recently explored on this target,
 * with a way to reopen each, and a link to all discoveries.
 */
export function DiscoveriesButton({
  targetId,
  targetName,
  saved,
  onOpen,
  className,
}: {
  targetId: string;
  targetName: string;
  saved: readonly Discovery[];
  onOpen: (s: ExplorerSelection) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [history] = useExploreHistory();
  const here = saved.filter((d) => d.targetId === targetId);
  const recent = history.filter((h) => h.targetId === targetId).slice(0, 6);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const select = (d: { kind: Discovery["kind"]; featureId?: string }) => {
    onOpen(d.kind === "object" || !d.featureId ? { kind: "object" } : ({ kind: d.kind, id: d.featureId } as ExplorerSelection));
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} className={className} title="Your discoveries">
        <Icons.Bookmark className="size-4" />
        <span className="max-[1899px]:sr-only">Discoveries</span>
        {here.length > 0 && <span className="rounded-full bg-accent/30 px-1.5 text-[10px] font-semibold text-foreground">{here.length}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Your discoveries" className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-border bg-surface-raised p-3 text-sm shadow-xl">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Saved on {targetName}</p>
          {here.length ? (
            <ul className="space-y-0.5">
              {here.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => select(d)} className="w-full truncate rounded-md px-2 py-1 text-left hover:bg-white/5">
                    {d.name}
                    {d.note && <span className="ml-1 text-xs text-muted">· {d.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 text-xs text-muted">Nothing yet. Open something in the explorer and press Save.</p>
          )}
          {recent.length > 0 && (
            <>
              <p className="mb-1.5 mt-3 text-[11px] uppercase tracking-wide text-muted">Recently explored</p>
              <div className="flex flex-wrap gap-1">
                {recent.map((h) => (
                  <button key={`${h.kind}/${h.featureId ?? ""}`} type="button" onClick={() => select(h)} className="rounded-md border border-border px-2 py-0.5 text-xs hover:border-accent/60">
                    {h.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <Link href="/discoveries" className="mt-3 flex items-center justify-between rounded-md px-2 py-1.5 text-accent hover:bg-accent/10">
            All discoveries <Icons.Chevron className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
