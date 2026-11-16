import { Panel } from "@/components/ui/fields";
import { ProvenanceBadge, ProvenanceLegend } from "@/components/ui/provenance-badge";
import { ASSUMPTIONS, type Metric, type SimulationResult } from "@/modules/simulations/engine";
import { CAMERA_METRIC_ORDER, EYEPIECE_METRIC_ORDER, METRIC_PRESENTATION } from "@/modules/simulations/presentation";

export function MetricsPanel({ result }: { result: SimulationResult }) {
  const rows: [string, Metric][] =
    result.mode === "eyepiece"
      ? EYEPIECE_METRIC_ORDER.flatMap((k) => (result.metrics[k] ? [[k, result.metrics[k]!] as [string, Metric]] : []))
      : CAMERA_METRIC_ORDER.flatMap((k) => (result.metrics[k] ? [[k, result.metrics[k]!] as [string, Metric]] : []));

  return (
    <div className="space-y-4">
      <Panel
        title="Results"
        actions={<span className="font-mono text-[11px] text-muted">engine v{result.engineVersion}</span>}
      >
        <ul className="divide-y divide-border">
          {rows.map(([key, metric]) => {
            const p = METRIC_PRESENTATION[key as keyof typeof METRIC_PRESENTATION];
            return (
              <li key={key}>
                <details className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
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
        <Panel title="Notes on this setup">
          <ul className="space-y-2 text-sm" role="list">
            {result.warnings.map((w) => (
              <li key={w.code} className="flex gap-2">
                <span aria-hidden className="text-warning">▲</span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Assumptions & limitations">
        <details>
          <summary className="cursor-pointer text-sm text-muted">
            {result.assumptions.length} assumptions apply to this result
          </summary>
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
        </details>
        <div className="mt-4 border-t border-border pt-3">
          <ProvenanceLegend />
        </div>
      </Panel>
    </div>
  );
}
