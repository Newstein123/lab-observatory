import { Panel } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge, ProvenanceLegend } from "@/components/ui/provenance-badge";
import { ASSUMPTIONS, type Metric, type SimulationResult } from "@/modules/simulations/engine";
import { CAMERA_METRIC_ORDER, EYEPIECE_METRIC_ORDER, METRIC_PRESENTATION } from "@/modules/simulations/presentation";

/** Shown over numbers from the last valid result while the current inputs can't produce one. */
export function StaleNote() {
  return (
    <p role="status" className="mb-2 rounded-md border border-warning/30 bg-warning/5 px-2 py-1 text-xs text-warning">
      Last valid result: these numbers don&apos;t match the current setup.
    </p>
  );
}

/**
 * `bare`: no outer cards (inside another card, e.g. a tab).
 * `stale`: `result` is the last valid one, not the current inputs' (dimmed and labelled).
 */
export function MetricsPanel({ result, bare = false, stale = false }: { result: SimulationResult; bare?: boolean; stale?: boolean }) {
  const rows: [string, Metric][] =
    result.mode === "eyepiece"
      ? EYEPIECE_METRIC_ORDER.flatMap((k) => (result.metrics[k] ? [[k, result.metrics[k]!] as [string, Metric]] : []))
      : CAMERA_METRIC_ORDER.flatMap((k) => (result.metrics[k] ? [[k, result.metrics[k]!] as [string, Metric]] : []));

  return (
    <div className="space-y-4">
      <Panel title="Results" icon={<Icons.Search />} className={bare ? "!border-0 !bg-none !p-0 [&>div:first-child]:sr-only" : ""}>
        {stale && <StaleNote />}
        <ul className={`divide-y divide-border ${stale ? "opacity-50" : ""}`}>
          {rows.map(([key, metric]) => {
            const p = METRIC_PRESENTATION[key as keyof typeof METRIC_PRESENTATION];
            return (
              <li key={key}>
                <details className="group py-2">
                  <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-raised/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 text-muted group-open:text-foreground">{p.label}</span>
                    <span className="font-mono tabular-nums">{p.format(metric)}</span>
                    <ProvenanceBadge kind={metric.kind} />
                  </summary>
                  <div className="mt-2 space-y-1 rounded bg-background p-2 text-xs text-muted">
                    {metric.formula && (
                      <p>
                        Formula: <code className="font-mono text-foreground">{metric.formula}</code>
                      </p>
                    )}
                    {metric.assumptions?.map((a) => (
                      <p key={a}>Assumes: {ASSUMPTIONS[a]}</p>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">Select a row to see its formula and assumptions.</p>
      </Panel>

      {result.warnings.length > 0 && (
        <Panel title="Notes on this setup" icon={<Icons.Warning />}>
          <ul className="space-y-2 text-sm" role="list">
            {result.warnings.map((w) => (
              <li key={w.code} className="flex gap-2 rounded-lg border border-warning/20 bg-warning/5 px-2.5 py-2">
                <Icons.Warning className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <details className="glass group/a rounded-2xl p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <Icons.Layers className="size-[18px] text-accent" />
          <h2 className="flex-1 text-[15px] font-semibold tracking-tight">Assumptions &amp; limitations</h2>
          <span className="text-xs text-muted">{result.assumptions.length} apply</span>
          <Icons.ChevronDown className="size-4 text-muted transition-transform group-open/a:rotate-180" />
        </summary>
        <div>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-muted">
            {result.assumptions.map((a) => (
              <li key={a}>{ASSUMPTIONS[a]}</li>
            ))}
            <li>
              The view uses a real reference image (credited below it) scaled to the calculated field, then blurred
              and dimmed by the calculated resolution, seeing and brightness. It is an approximation, not a photograph
              through your telescope; without an image, a labelled schematic is shown.
            </li>
            <li>
              In the eyepiece view of deep-sky targets, stars come from the Gaia, Tycho-2 and Hipparcos catalogues: real
              positions, magnitudes and colours, shown down to your aperture&apos;s estimated limiting magnitude
              (2 + 5·log₁₀ D, dark sky). Colour appears only for stars about 4.5 magnitudes or more above that limit, and
              stays pale, as the eye perceives it; this threshold is an estimate. Fainter stars are catalogued only within
              0.6° of the target, so very wide fields show fewer faint stars towards the edge.
            </li>
          </ul>
        <div className="mt-4 border-t border-border pt-3">
          <ProvenanceLegend />
        </div>
        </div>
      </details>
    </div>
  );
}
