"use client";

import { useMemo, useState } from "react";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs } from "@/components/ui/tabs";
import { TARGET_GROUPS, TARGETS, type CuratedTarget } from "@/modules/targets/catalogue";
import type { ReachAssessment } from "@/modules/targets/reach";

type GroupId = (typeof TARGET_GROUPS)[number]["category"];

const groupOf = (t: CuratedTarget): GroupId => TARGET_GROUPS.find((g) => g.categories.includes(t.category))!.category;

interface Props {
  value: CuratedTarget;
  onChange: (t: CuratedTarget) => void;
  /** How well the current setup can show a target. */
  assess: (t: CuratedTarget) => ReachAssessment;
  /** Extra controls on the group row (e.g. the mode switch). */
  toolbar?: React.ReactNode;
}

/**
 * Targets grouped by kind. Targets the current setup cannot show are hidden
 * (the selected target always stays visible), with a switch to show them.
 */
export function TargetPicker({ value, onChange, assess, toolbar }: Props) {
  const [group, setGroup] = useState<GroupId>(groupOf(value));
  const [showAll, setShowAll] = useState(false);

  const assessed = useMemo(() => new Map(TARGETS.map((t) => [t.id, assess(t)])), [assess]);
  const inGroup = TARGETS.filter((t) => groupOf(t) === group);
  const visible = inGroup.filter((t) => showAll || t.id === value.id || assessed.get(t.id)!.reach !== "out_of_reach");
  const hidden = inGroup.length - visible.length;
  const hiddenTotal = TARGETS.filter((t) => t.id !== value.id && assessed.get(t.id)!.reach === "out_of_reach").length;
  const current = assessed.get(value.id) ?? assess(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<GroupId>
          label="Target type"
          value={group}
          onChange={setGroup}
          items={TARGET_GROUPS.map((g) => {
            const n = TARGETS.filter((t) => groupOf(t) === g.category && (showAll || t.id === value.id || assessed.get(t.id)!.reach !== "out_of_reach")).length;
            return { id: g.category, label: g.label, count: n };
          })}
        />
        {toolbar}
      </div>

      <div role="group" aria-label="Target" className="flex flex-wrap gap-1.5">
        {visible.map((t) => {
          const a = assessed.get(t.id)!;
          const selected = t.id === value.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={selected}
              title={`${t.name}${t.designation ? ` (${t.designation})` : ""} · ${t.subtype}${a.reasons[0] ? `\n${a.reasons[0]}` : ""}`}
              onClick={() => onChange(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                selected ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"
              } ${a.reach === "out_of_reach" ? "opacity-60" : ""}`}
            >
              {a.reach !== "good" && (
                <span aria-hidden className={`size-1.5 rounded-full ${a.reach === "challenging" ? "bg-warning" : "bg-danger"}`} />
              )}
              <span className={t.designation ? "font-medium" : ""}>{t.designation ?? t.name}</span>
              {t.designation && <span className="hidden text-xs text-subtle sm:inline">{t.name}</span>}
              {a.reach !== "good" && <span className="sr-only">({a.reach === "challenging" ? "challenging" : "out of reach"} with this setup)</span>}
            </button>
          );
        })}
      </div>

      {(hidden > 0 || showAll) && hiddenTotal > 0 && (
        <p className="text-xs text-muted">
          {showAll ? "Showing every target, including ones this setup can't show." : `${hidden} ${hidden === 1 ? "target is" : "targets are"} hidden: out of reach for this setup.`}{" "}
          <button type="button" className="text-accent hover:underline" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Hide them" : "Show all"}
          </button>
        </p>
      )}

      {current.reach !== "good" && (
        <div
          role="status"
          className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${
            current.reach === "out_of_reach" ? "border-danger/40 bg-danger/5" : "border-warning/40 bg-warning/5"
          }`}
        >
          <span aria-hidden className={current.reach === "out_of_reach" ? "text-danger" : "text-warning"}>
            ▲
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {current.reach === "out_of_reach" ? `${value.name} is out of reach for this setup` : `${value.name} is challenging with this setup`}
              <ProvenanceBadge kind="estimated" />
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {current.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
