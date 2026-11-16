"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatAngleArcsec } from "@/lib/format";
import type { FilterKind, SimulationResult } from "@/modules/simulations/engine";
import { drawCameraView } from "@/modules/simulations/renderers/camera-view";
import { drawEyepieceView } from "@/modules/simulations/renderers/eyepiece-view";
import {
  computeCameraLayout,
  computeEyepieceLayout,
  niceScaleBarArcsec,
} from "@/modules/simulations/renderers/layout";
import type { CuratedTarget } from "@/modules/targets/catalogue";
import type { SatelliteMark } from "@/modules/simulations/renderers/satellite-drawing";
import { SATELLITE_METHOD, satellitesOf } from "@/modules/targets/satellites";
import { STAR_CREDIT, STAR_LICENSE, STAR_LICENSE_URL } from "@/modules/targets/star-fields";
import { useReferenceImage } from "@/modules/targets/use-reference-image";
import { useStarField } from "@/modules/targets/use-star-field";
import { ReferenceCredit } from "./reference-credit";

export interface ViewSettings {
  focusOffset: number;
  longExposureColor: boolean;
  zoom: number;
  gain: number;
  exposureS: number;
  /** Filter in the light path (from the configuration). */
  filterKind?: FilterKind;
  /** Time of the view (ISO 8601), for moving things such as Jupiter's moons. Default: now. */
  observedAt?: string;
}

interface Props {
  result: SimulationResult;
  target: CuratedTarget;
  settings: ViewSettings;
  stale: boolean;
  /** Cap on the drawing size, CSS px. */
  maxSizePx?: number;
  /** Thumbnail mode: no overlays or credit. */
  compact?: boolean;
  /** Lets the user change the time (moons); without it the time is shown read-only. */
  onObservedAtChange?: (iso: string) => void;
}

const MAX_EYEPIECE_PX = 560;
const MAX_CAMERA_HEIGHT_PX = 520;

export function SimulationViewport({
  result,
  target,
  settings,
  stale,
  maxSizePx = MAX_EYEPIECE_PX,
  compact = false,
  onObservedAtChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const referenceState = useReferenceImage(target.id);
  const reference = referenceState.status === "ready" ? referenceState.reference : undefined;
  // Eyepiece "as seen by eye": star-free survey image plus catalogue stars.
  const wantVisual = result.mode === "eyepiece" && !settings.longExposureColor;
  const objectState = useReferenceImage(target.id, wantVisual ? "object" : "full");
  const starField = useStarField(target.id, wantVisual);
  const objectRef = objectState.status === "ready" ? objectState.reference : undefined;
  const visual = useMemo(
    () => (wantVisual && objectRef && starField && objectRef.meta.src !== reference?.meta.src ? { object: objectRef, starField } : undefined),
    [wantVisual, objectRef, starField, reference],
  );
  const [starInfo, setStarInfo] = useState<{ shown: number; limit: number }>();
  const [mountedAt] = useState(() => new Date().toISOString());
  const observedAt = settings.observedAt ?? mountedAt;
  const satellites = useMemo(() => satellitesOf(target.id, new Date(observedAt)), [target.id, observedAt]);
  const [marks, setMarks] = useState<SatelliteMark[]>([]);
  const updateMarks = (next: SatelliteMark[] = []) =>
    setMarks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(Math.floor(el.clientWidth));
    const ro = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Size the drawing surface in CSS pixels.
  let width = 0;
  let height = 0;
  if (containerWidth > 0) {
    if (result.mode === "eyepiece") {
      width = height = Math.min(containerWidth, maxSizePx);
    } else if (result.framing.shape === "rectangle") {
      const aspect = result.framing.fieldHeightArcsec / result.framing.fieldWidthArcsec;
      width = Math.min(containerWidth, Math.floor(Math.min(MAX_CAMERA_HEIGHT_PX, maxSizePx) / aspect));
      height = Math.round(width * aspect);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (result.mode === "eyepiece") {
      const info = drawEyepieceView(ctx, result, width, {
        target,
        focusOffset: settings.focusOffset,
        longExposureColor: settings.longExposureColor,
        reference,
        filterKind: settings.filterKind,
        visual,
        satellites,
      });
      updateMarks(info.satellites);
      const next = info.starsShown !== undefined ? { shown: info.starsShown, limit: info.starLimitMag! } : undefined;
      setStarInfo((prev) => (prev?.shown === next?.shown && prev?.limit === next?.limit ? prev : next));
    } else {
      const info = drawCameraView(ctx, result, width, {
        target,
        zoom: settings.zoom,
        gain: settings.gain,
        exposureS: settings.exposureS,
        reference,
        filterKind: settings.filterKind,
        satellites,
      });
      updateMarks(info.satellites);
      setStarInfo(undefined);
    }
  }, [result, target, settings, width, height, reference, visual, satellites]);

  // Scale bar from the same pure layout the renderer uses.
  let scaleBar: { px: number; label: string } | null = null;
  if (width > 0) {
    let pxPerArcsec: number;
    let spanArcsec: number;
    if (result.mode === "eyepiece") {
      const l = computeEyepieceLayout(result, width, { category: target.category, focusOffset: 0 });
      pxPerArcsec = l.pxPerArcsec;
      spanArcsec = (2 * l.fieldRadiusPx) / pxPerArcsec;
    } else {
      const l = computeCameraLayout(result, width, { category: target.category, zoom: settings.zoom, gain: 1 });
      pxPerArcsec = width / l.visibleWidthArcsec;
      spanArcsec = l.visibleWidthArcsec;
    }
    const arcsec = niceScaleBarArcsec(spanArcsec * 0.3);
    scaleBar = { px: arcsec * pxPerArcsec, label: formatAngleArcsec(arcsec) };
  }

  const fieldLabel =
    result.framing.shape === "circle"
      ? `Field ${formatAngleArcsec(result.framing.fieldDiameterArcsec)}`
      : `Field ${formatAngleArcsec(result.framing.fieldWidthArcsec / settings.zoom)} × ${formatAngleArcsec(result.framing.fieldHeightArcsec / settings.zoom)}`;

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative mx-auto" style={{ width: width || undefined, height: height || undefined }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${result.mode === "eyepiece" ? "Eyepiece" : "Camera"} view of ${target.name}. ${fieldLabel}.`}
          style={{ width, height }}
          className={`block ${result.mode === "camera" ? "rounded-sm border border-border" : "rounded-full shadow-[0_0_0_1px_rgba(108,123,255,0.25),0_0_60px_-10px_rgba(81,98,255,0.35)]"} ${stale ? "opacity-40" : ""}`}
        />
        {width > 0 && !compact && (
          <>
            <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
              {reference ? (
                <>
                  <ProvenanceBadge kind="retrieved" />
                  <ProvenanceBadge kind="illustrative" />
                  {width >= 520 && (
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-muted">
                      {visual ? "Catalogue stars + survey image" : "Real image, degraded to your setup"}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <ProvenanceBadge kind="illustrative" />
                  {width >= 520 && (
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-muted">
                      {referenceState.status === "loading" ? "Loading reference image…" : "Schematic, not imagery"}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {fieldLabel}
            </div>
            {starInfo && (
              <div
                className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-muted"
                title="Catalogue stars brighter than this setup's estimated limiting magnitude"
              >
                {starInfo.shown} stars · to mag {starInfo.limit.toFixed(1)}
              </div>
            )}
            {placeLabels(marks).map((m) => (
              <span
                key={m.name}
                className="pointer-events-none absolute -translate-x-1/2 text-[10px] leading-none text-foreground/55"
                style={{ left: width / 2 + m.x, top: height / 2 + m.y + m.dy }}
              >
                {m.name}
              </span>
            ))}
            {scaleBar && (
              <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col items-start gap-1">
                <div className="h-px bg-foreground/80" style={{ width: scaleBar.px }} />
                <span className="font-mono text-[11px] text-foreground/80">{scaleBar.label}</span>
              </div>
            )}
            {stale && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded bg-black/80 px-3 py-2 text-sm text-warning">
                  Inputs invalid — showing last valid result
                </p>
              </div>
            )}
          </>
        )}
      </div>
      {satellites.length > 0 && !compact && (
        <MoonTime
          planet={target.name}
          observedAt={observedAt}
          onChange={onObservedAtChange}
          notes={satellites.filter((s) => s.hidden).map((s) => `${s.name} is ${s.inFront ? "crossing in front of" : "behind"} ${target.name}`)}
          outside={satellites.filter((s) => !s.hidden && !marks.some((m) => m.name === s.name)).map((s) => s.name)}
        />
      )}
      {reference && !compact && <ReferenceCredit meta={reference.meta} />}
      {visual && !compact && (
        <p className="mt-1 text-xs text-muted">
          {STAR_CREDIT}{" "}
          <a href={STAR_LICENSE_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {STAR_LICENSE}
          </a>{" "}
          Stars are drawn to the estimated limiting magnitude of your aperture; colour is shown only for stars bright enough
          for the eye to perceive it (estimated).
        </p>
      )}
    </div>
  );
}

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MoonTime({
  planet,
  observedAt,
  onChange,
  notes,
  outside,
}: {
  planet: string;
  observedAt: string;
  onChange?: (iso: string) => void;
  notes: string[];
  outside: string[];
}) {
  return (
    <div className="mt-3 space-y-1 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-2">
        <span>{planet}&apos;s moons placed for</span>
        {onChange ? (
          <>
            <input
              type="datetime-local"
              aria-label="Date and time for moon positions"
              value={toLocalInput(observedAt)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!Number.isNaN(d.getTime())) onChange(d.toISOString());
              }}
              className="rounded-md border border-border bg-surface-sunken px-2 py-1 font-mono text-xs text-foreground"
            />
            <button type="button" className="text-accent hover:underline" onClick={() => onChange(new Date().toISOString())}>
              Now
            </button>
          </>
        ) : (
          <span className="font-mono text-foreground">{new Date(observedAt).toLocaleString()}</span>
        )}
        <ProvenanceBadge kind="calculated" />
      </div>
      {(notes.length > 0 || outside.length > 0) && (
        <p>
          {[...notes, ...(outside.length ? [`${outside.join(", ")} ${outside.length === 1 ? "is" : "are"} outside this field of view`] : [])].join(" · ")}.
        </p>
      )}
      <p className="text-subtle">
        North up, west to the right, as on the sky. A star diagonal mirrors this and a straight-through telescope turns
        it upside down. {SATELLITE_METHOD}
      </p>
    </div>
  );
}

/** Label offsets (px) to try in turn: below, above, then further out. */
const LABEL_ROWS = [7, -17, 19, -29, 31, -41];

/**
 * Put each moon's name next to it without overlapping the others: labels go
 * below the moon, or above, or further out when neighbours are close.
 */
function placeLabels(marks: SatelliteMark[]): (SatelliteMark & { dy: number })[] {
  const placed: { left: number; right: number; top: number }[] = [];
  return [...marks]
    .sort((a, b) => a.x - b.x)
    .map((m) => {
      const half = (m.name.length * 5.6) / 2 + 3;
      const dy =
        LABEL_ROWS.find((row) => !placed.some((p) => Math.abs(p.top - (m.y + row)) < 11 && p.left < m.x + half && m.x - half < p.right)) ??
        LABEL_ROWS[LABEL_ROWS.length - 1];
      placed.push({ left: m.x - half, right: m.x + half, top: m.y + dy });
      return { ...m, dy };
    });
}
