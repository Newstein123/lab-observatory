import { formatDateTime } from "@/lib/format";
import type { ReferenceImage } from "@/modules/targets/reference-images";

/** Attribution and caveats for the reference image shown in a view. */
export function ReferenceCredit({ meta }: { meta: ReferenceImage }) {
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer">
        Image: {meta.source.credit.length > 90 ? `${meta.source.credit.slice(0, 90)}…` : meta.source.credit} ·{" "}
        {meta.source.licenseUrl ? (
          <a href={meta.source.licenseUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {meta.source.license}
          </a>
        ) : (
          meta.source.license
        )}
      </summary>
      <div className="mt-2 space-y-1.5 rounded bg-surface p-3">
        <p>{meta.source.credit}</p>
        <p>{meta.source.description}</p>
        <p>
          Source:{" "}
          <a href={meta.source.pageUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {meta.source.name}
          </a>
          , retrieved {formatDateTime(meta.source.retrievedAt)}. {meta.processing}
        </p>
        {meta.kind === "field" && meta.objectProcessing && <p>Eyepiece view: {meta.objectProcessing}</p>}
        <p className="text-foreground/80">
          The view scales this image to the calculated field, then applies the calculated resolution, seeing and
          brightness. It cannot show detail finer than your setup resolves, but it is still an approximation.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          {meta.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
