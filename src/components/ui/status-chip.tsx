import type { ConfigurationStatus } from "@/modules/configurations/models";

const STYLES: Record<ConfigurationStatus, { label: string; className: string }> = {
  owned: { label: "Owned", className: "border-prov-retrieved/40 text-prov-retrieved" },
  experimental: { label: "Experimental", className: "border-prov-illustrative/40 text-prov-illustrative" },
  planned: { label: "Planned", className: "border-prov-calculated/40 text-prov-calculated" },
};

export function StatusChip({ status }: { status: ConfigurationStatus }) {
  const s = STYLES[status];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${s.className}`}>{s.label}</span>;
}
