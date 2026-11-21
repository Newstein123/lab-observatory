"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { signInHref } from "@/modules/auth/use-auth";
import { Tabs } from "@/components/ui/tabs";
import { TAB_LABELS, tabsFor } from "@/modules/explorer/registry";
import type { ExplorerTab } from "@/modules/explorer/types";
import { selectionKey, selectionName, type ExplorerContext } from "./explorer-context";
import { LearnTab } from "./learn-tab";
import { ModelTab } from "./model-tab";
import { ObjectInfoTab } from "./object-info-tab";
import { SurfaceMap } from "./surface-map";
import { SkyImageViewer } from "./sky-image-viewer";

const TAB_ICONS: Record<ExplorerTab, (p: { className?: string }) => React.ReactNode> = {
  info: Icons.Info,
  model: Icons.Rotate,
  map: Icons.Grid,
  image: Icons.Image,
  learn: Icons.Sparkles,
};

/**
 * ObjectInformationPanel: the Astronomical Object Explorer beside the view.
 * Tabs adapt to what is selected (registry.ts).
 */
export function ObjectExplorerPanel({ ctx, tabRequest }: { ctx: ExplorerContext; tabRequest?: { tab: ExplorerTab; n: number } }) {
  const tabs = tabsFor(ctx.object, ctx.selection);
  const [wanted, setWanted] = useState<ExplorerTab>(tabRequest?.tab ?? "info");
  useEffect(() => {
    if (tabRequest) setWanted(tabRequest.tab);
  }, [tabRequest]);
  const tab = tabs.includes(wanted) ? wanted : "info";
  const pinned = selectionKey(ctx.pinned) === selectionKey(ctx.selection);
  const crumb = selectionName(ctx);

  return (
    <section aria-label="Object Explorer" className="glass flex min-h-[420px] flex-col rounded-2xl p-2 xl:min-h-0 xl:flex-1" data-testid="object-explorer">
      <div className="flex items-center gap-2 px-1 pb-2">
        <nav aria-label="Explorer location" className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted">
          <button type="button" onClick={() => ctx.onSelect({ kind: "object" })} className="truncate hover:text-foreground">
            {ctx.object.name}
          </button>
          {crumb && (
            <>
              <Icons.Chevron className="size-3 shrink-0" />
              <span className="truncate text-foreground">{crumb}</span>
            </>
          )}
        </nav>
        {ctx.discovery &&
          (ctx.discovery.canSave ? (
            <button
              type="button"
              onClick={ctx.discovery.onToggle}
              disabled={ctx.discovery.busy}
              aria-pressed={Boolean(ctx.discovery.saved)}
              title={ctx.discovery.saved ? "Remove from your discoveries" : "Save to your discoveries"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50 ${
                ctx.discovery.saved ? "border-accent bg-accent/20" : "border-border text-muted hover:text-foreground"
              }`}
            >
              <Icons.Bookmark className="size-3.5" />
              {ctx.discovery.saved ? "Saved" : "Save"}
            </button>
          ) : (
            <a href={signInHref()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:text-foreground">
              <Icons.Bookmark className="size-3.5" />
              Sign in to save
            </a>
          ))}
        <button
          type="button"
          onClick={() => ctx.onPin(ctx.selection)}
          aria-pressed={pinned}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${pinned ? "border-accent bg-accent/20" : "border-border text-muted hover:text-foreground"}`}
        >
          <Icons.Pin className="size-3.5" />
          {pinned ? "Pinned" : "Pin"}
        </button>
        <button type="button" onClick={ctx.onClose} aria-label="Close the explorer" className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-foreground">
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>
      </div>
      <Tabs<ExplorerTab>
        label="Explorer"
        variant="segmented"
        className="flex w-full shrink-0 [&>button]:flex-1"
        value={tab}
        onChange={setWanted}
        items={tabs.map((t) => {
          const Icon = TAB_ICONS[t];
          return {
            id: t,
            label: (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Icon className="size-4" />
                {TAB_LABELS[t]}
              </span>
            ),
          };
        })}
      />
      <div role="tabpanel" aria-label={TAB_LABELS[tab]} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3 xl:[scrollbar-width:thin]">
        {tab === "info" && <ObjectInfoTab ctx={ctx} />}
        {tab === "model" && <ModelTab key={selectionKey(ctx.selection)} ctx={ctx} />}
        {tab === "map" && <SurfaceMap ctx={ctx} />}
        {tab === "image" && <SkyImageViewer ctx={ctx} />}
        {tab === "learn" && <LearnTab ctx={ctx} />}
      </div>
    </section>
  );
}
