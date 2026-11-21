import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatAngleArcsec, formatDec, formatRa } from "@/lib/format";
import type { Equatorial } from "@/modules/sky/coords";
import type { CuratedTarget } from "@/modules/targets/catalogue";

/**
 * `positionOfDate`: for the Moon and planets, the position calculated for the
 * chosen time (then `target` carries that date's size and magnitude).
 */
export function TargetInfo({ target, positionOfDate }: { target: CuratedTarget; positionOfDate?: Equatorial }) {
  const { angularSize, coordinatesJ2000, provenance } = target;
  const dated = !coordinatesJ2000 && positionOfDate !== undefined;
  const kind = dated ? "calculated" : provenance.verification === "verified" ? "retrieved" : "estimated";
  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">
          {target.name}
          {target.designation && <span className="ml-2 font-normal text-muted">{target.designation}</span>}
        </h3>
        <span className="text-xs text-muted">{[target.subtype, typeof target.magnitude === "number" ? `magnitude ${target.magnitude.toFixed(1)}` : undefined].filter(Boolean).join(" · ")}</span>
      </div>
      <dl className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Apparent size</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono">
              {formatAngleArcsec(angularSize.majorAxisArcsec)}
              {angularSize.minorAxisArcsec !== angularSize.majorAxisArcsec &&
                ` × ${formatAngleArcsec(angularSize.minorAxisArcsec)}`}
            </span>
            <ProvenanceBadge kind={kind} />
          </dd>
          {angularSize.rangeArcsec && !dated && (
            <dd className="text-xs text-muted">
              Varies {formatAngleArcsec(angularSize.rangeArcsec.min)}–{formatAngleArcsec(angularSize.rangeArcsec.max)}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-muted">{dated ? "Position (of date)" : "Position (J2000)"}</dt>
          <dd className="flex items-center gap-2 font-mono">
            {coordinatesJ2000
              ? `${formatRa(coordinatesJ2000.raDeg)}  ${formatDec(coordinatesJ2000.decDeg)}`
              : positionOfDate
                ? `${formatRa(positionOfDate.raDeg)}  ${formatDec(positionOfDate.decDeg)}`
                : "Moves; needs an ephemeris"}
            {dated && <ProvenanceBadge kind="calculated" />}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">{angularSize.note}</p>
      {dated ? (
        <p className="mt-1 text-xs text-muted">
          Size, brightness and position for the chosen date from low-precision theories (Meeus; JPL approximate elements), checked
          against JPL Horizons to within 0.1°.
        </p>
      ) : provenance.verification === "pending" && (
        <p className="mt-1 text-xs text-warning">
          Reference value, not yet checked against{" "}
          {provenance.authoritativeProvider === "simbad" ? "SIMBAD" : "JPL Horizons"}.
        </p>
      )}
    </div>
  );
}
