import type { Provenance } from "@/modules/simulations/engine";

const STYLES: Record<Provenance, { label: string; className: string; description: string }> = {
  calculated: {
    label: "Calculated",
    className: "text-prov-calculated border-prov-calculated/40 bg-prov-calculated/10",
    description: "Derived directly from your inputs with a documented formula.",
  },
  retrieved: {
    label: "Retrieved",
    className: "text-prov-retrieved border-prov-retrieved/40 bg-prov-retrieved/10",
    description: "Provided by an identified astronomical data source.",
  },
  estimated: {
    label: "Estimated",
    className: "text-prov-estimated border-prov-estimated/40 bg-prov-estimated/10",
    description: "An approximation based on stated assumptions or a simplified model.",
  },
  illustrative: {
    label: "Illustrative",
    className: "text-prov-illustrative border-prov-illustrative/40 bg-prov-illustrative/10",
    description: "A visualisation to communicate framing or appearance, not a measurement.",
  },
};

export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  const s = STYLES[kind];
  return (
    <span
      title={s.description}
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function ProvenanceLegend() {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)] gap-2 text-xs text-muted">
      {(Object.keys(STYLES) as Provenance[]).map((k) => (
        <div key={k} className="flex items-start gap-2">
          <dt>
            <ProvenanceBadge kind={k} />
          </dt>
          <dd>{STYLES[k].description}</dd>
        </div>
      ))}
    </dl>
  );
}
