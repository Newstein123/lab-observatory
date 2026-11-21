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
import type { ViewAtmosphere, ViewPhase } from "@/modules/simulations/renderers/atmosphere";
import { poleAngleDeg } from "@/modules/sky/planets";
import { SATELLITE_METHOD, SATURN_MOON_METHOD, satellitesOf } from "@/modules/targets/satellites";
import { STAR_CREDIT, STAR_LICENSE, STAR_LICENSE_URL } from "@/modules/targets/star-fields";
import { useReferenceImage } from "@/modules/targets/use-reference-image";
import { useStarField } from "@/modules/targets/use-star-field";
import { ReferenceCredit } from "./reference-credit";
import { skyGrid } from "@/modules/simulations/renderers/sky-grid";
import { displayFilter, orient, ORIENTATION_CSS, type ViewDisplay, type ViewLayers } from "./view-options";
import type { Site } from "@/modules/sky/coords";
import { moonOrientation } from "@/modules/sky/moon";
import { placeFeatures, placeRings, type PlacedFeature, type PlacedRing, type ViewGeometry } from "@/modules/explorer/identify";
import { loadSaturnMoonData, type SaturnMoonData } from "@/modules/targets/saturn-moons";
import { useMoonDisc } from "@/modules/explorer/use-moon-disc";
import { FeatureAnnotationLayer, identifyAt, type CompanionMark, type ExplorerViewProps } from "@/components/explorer/feature-layer";

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
  /** Sky, air and cloud; omitted for a plain dark sky. */
  atmosphere?: ViewAtmosphere;
  /** Moon or planet phase at that time. */
  phase?: ViewPhase;
  /** Where the observer is, for the Moon's topocentric libration. Default: the Earth's centre. */
  site?: Site;
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
  /** Shown over the middle of the view (e.g. "below the horizon"). */
  overlay?: React.ReactNode;
  /** An extra chip in the top-left corner. */
  badge?: React.ReactNode;
  /** Where the target sits from the field centre, arcsec (x west/right, y south/down); the telescope nudged off it. */
  pan?: { x: number; y: number };
  /** Lets the user drag (or use the arrow keys) to move the telescope. */
  onPanChange?: (pan: { x: number; y: number }) => void;
  layers?: ViewLayers;
  display?: ViewDisplay;
  /** The target's position of date, for the coordinate grid. */
  equatorial?: { raDeg: number; decDeg: number };
  /** The other instrument's field, for the field-boundary layer. */
  otherField?: { shape: "circle"; diameterArcsec: number; label: string } | { shape: "rect"; widthArcsec: number; heightArcsec: number; label: string };
  /** Buttons in the bottom-right corner. */
  tools?: React.ReactNode;
  /** Identification of features and companions inside the view. */
  explorer?: ExplorerViewProps;
}

const MAX_EYEPIECE_PX = 560;

export function SimulationViewport({
  result,
  target,
  settings,
  stale,
  maxSizePx = MAX_EYEPIECE_PX,
  compact = false,
  onObservedAtChange,
  overlay,
  badge,
  pan,
  onPanChange,
  layers,
  display,
  equatorial,
  otherField,
  tools,
  explorer,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const referenceState = useReferenceImage(target.id);
  const photoReference = referenceState.status === "ready" ? referenceState.reference : undefined;
  // Eyepiece "as seen by eye": star-free survey image plus catalogue stars.
  const wantVisual = result.mode === "eyepiece" && !settings.longExposureColor;
  const objectState = useReferenceImage(target.id, wantVisual ? "object" : "full");
  const starField = useStarField(target.id, wantVisual);
  const objectRef = objectState.status === "ready" ? objectState.reference : undefined;
  const visual = useMemo(
    // Survey fields only (the Moon's projected disc never has a star-free variant).
    () => (wantVisual && objectRef && starField && objectRef.meta.src !== photoReference?.meta.src ? { object: objectRef, starField } : undefined),
    [wantVisual, objectRef, starField, photoReference],
  );
  const [starInfo, setStarInfo] = useState<{ shown: number; limit: number }>();
  const [mountedAt] = useState(() => new Date().toISOString());
  const observedAt = settings.observedAt ?? mountedAt;
  // Saturn's moon models are loaded only when Saturn is shown.
  const [saturnData, setSaturnData] = useState<SaturnMoonData>();
  useEffect(() => {
    if (target.id === "saturn") loadSaturnMoonData().then(setSaturnData, () => {});
  }, [target.id]);
  const satellites = useMemo(() => satellitesOf(target.id, new Date(observedAt), saturnData), [target.id, observedAt, saturnData]);
  // The Moon as it faces this observer at this time: libration and axis angle.
  const siteKey = settings.site ? `${settings.site.latDeg},${settings.site.lonDeg}` : "";
  const moonOrient = useMemo(
    () => (target.id === "moon" ? moonOrientation(new Date(observedAt), settings.site) : undefined),
    [target.id, observedAt, siteKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Planets and the Moon are drawn with their real tilt on a north-up sky (belts, rings, moons' line, lunar axis).
  const bodyRotationDeg = useMemo(
    () => moonOrient?.axisPaDeg ?? poleAngleDeg(target.id, new Date(observedAt)),
    [target.id, observedAt, moonOrient],
  );
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
      width = Math.min(containerWidth, Math.floor(maxSizePx / aspect));
      height = Math.round(width * aspect);
    }
  }

  // Scale of the drawing, from the same pure layout the renderer uses.
  let geom: { pxPerArcsec: number; spanArcsec: number; fieldRadiusPx?: number; targetPx: number } | null = null;
  if (width > 0) {
    if (result.mode === "eyepiece") {
      const l = computeEyepieceLayout(result, width, { category: target.category, focusOffset: 0 });
      geom = { pxPerArcsec: l.pxPerArcsec, spanArcsec: (2 * l.fieldRadiusPx) / l.pxPerArcsec, fieldRadiusPx: l.fieldRadiusPx, targetPx: l.targetMajorPx };
    } else {
      const l = computeCameraLayout(result, width, { category: target.category, zoom: settings.zoom, gain: 1 });
      const ppa = width / l.visibleWidthArcsec;
      geom = { pxPerArcsec: ppa, spanArcsec: l.visibleWidthArcsec, targetPx: result.framing.targetMajorArcsec * ppa };
    }
  }
  const panPx = geom && pan ? { x: pan.x * geom.pxPerArcsec, y: pan.y * geom.pxPerArcsec } : undefined;

  // The Moon from the LRO global map, projected for tonight's libration so that
  // feature labels land on the features; the photograph is the fallback.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const moonDisc = useMoonDisc(target.id === "moon", moonOrient, (geom?.targetPx ?? 0) * dpr);
  const reference = moonDisc ?? photoReference;
  const panKey = panPx ? `${panPx.x.toFixed(1)},${panPx.y.toFixed(1)}` : "";
  const orientation = display?.orientation ?? "sky";
  const showLayer = (k: keyof ViewLayers) => (layers ? layers[k] : k === "labels" || k === "scale");

  // --- Identification: where features and companions are on screen ---
  const viewGeom: ViewGeometry | undefined =
    geom && width > 0
      ? { width, height, targetPx: geom.targetPx, panPx: panPx ?? { x: 0, y: 0 }, orientation, fieldRadiusPx: geom.fieldRadiusPx }
      : undefined;
  const surface = explorer?.geometry;
  const placed: PlacedFeature[] = useMemo(
    () => (explorer && surface?.project && viewGeom && explorer.object.features.length ? placeFeatures(explorer.object.features, surface.project, surface.bodyRadiusKm, viewGeom, surface.featureRadius) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [explorer?.object, surface, width, height, geom?.targetPx, geom?.fieldRadiusPx, panKey, orientation],
  );
  const placedRings: PlacedRing[] = useMemo(
    () => (explorer && surface?.rings && viewGeom ? placeRings(explorer.object.rings, surface.rings, viewGeom) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [explorer?.object, surface, width, height, geom?.targetPx, panKey, orientation],
  );
  const companionMarks: CompanionMark[] =
    explorer && explorer.object.companions.length
      ? placeLabels(marks).flatMap((m) => {
          const c = explorer.object.companions.find((x) => x.name === m.name);
          if (!c) return [];
          const p = orient(orientation, m.x + (panPx?.x ?? 0), m.y + (panPx?.y ?? 0));
          return [{ id: c.id, name: c.name, x: width / 2 + p.x, y: height / 2 + p.y, labelDy: m.dy }];
        })
      : [];
  // Moons not drawn: beyond the field, or in it but too faint for this setup.
  const unseen = { outside: [] as string[], faint: [] as string[] };
  for (const s of satellites) {
    if (s.hidden || marks.some((m) => m.name === s.name)) continue;
    const r = geom ? Math.hypot(s.x * (geom.targetPx / 2) + (panPx?.x ?? 0), s.y * (geom.targetPx / 2) - (panPx?.y ?? 0)) : Infinity;
    const fieldR = geom?.fieldRadiusPx ?? Math.max(width, height) / 2;
    (r > fieldR ? unseen.outside : unseen.faint).push(s.name);
  }
  const [hover, setHover] = useState<{ x: number; y: number; label: string }>();
  const nameOf = (sel: ReturnType<typeof identifyAt>) => {
    if (!sel || !explorer) return undefined;
    if (sel.kind === "object") return explorer.object.name;
    if (sel.kind === "feature") return explorer.object.features.find((f) => f.id === sel.id)?.name;
    if (sel.kind === "ring") return explorer.object.rings.find((r) => r.id === sel.id)?.name;
    return explorer.object.companions.find((c) => c.id === sel.id)?.name;
  };
  const pointIn = (e: React.PointerEvent) => {
    const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

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
        atmosphere: settings.atmosphere,
        phase: settings.phase,
        bodyRotationDeg,
        panPx,
      });
      const next = info.starsShown !== undefined ? { shown: info.starsShown, limit: info.starLimitMag! } : undefined;
      // The readouts (star count, moon labels) follow the drawing on the next frame, not
      // inside this effect: while the view is dragged, setting state here on every frame
      // makes a long chain of effect-driven renders that React reports as a loop.
      const frame = requestAnimationFrame(() => {
        updateMarks(info.satellites);
        setStarInfo((prev) => (prev?.shown === next?.shown && prev?.limit === next?.limit ? prev : next));
      });
      return () => cancelAnimationFrame(frame);
    } else {
      const info = drawCameraView(ctx, result, width, {
        target,
        zoom: settings.zoom,
        gain: settings.gain,
        exposureS: settings.exposureS,
        reference,
        filterKind: settings.filterKind,
        satellites,
        atmosphere: settings.atmosphere,
        phase: settings.phase,
        bodyRotationDeg,
        panPx,
      });
      const frame = requestAnimationFrame(() => {
        updateMarks(info.satellites);
        setStarInfo(undefined);
      });
      return () => cancelAnimationFrame(frame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, target, settings, width, height, reference, visual, satellites, bodyRotationDeg, panKey]);

  let scaleBar: { px: number; label: string } | null = null;
  if (geom) {
    const arcsec = niceScaleBarArcsec(geom.spanArcsec * 0.3);
    scaleBar = { px: arcsec * geom.pxPerArcsec, label: formatAngleArcsec(arcsec) };
  }

  // Moving the telescope: drag, or the arrow keys when the view has focus.
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);
  // At most one pan update per animation frame, however fast pointer events arrive.
  const pendingPan = useRef<{ x: number; y: number } | null>(null);
  const panFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(panFrame.current), []);
  // Like slewing a real telescope: the field can go anywhere over the target, up to
  // its edge (or a field's width around a small target).
  const fieldRadiusArcsec = geom ? (geom.fieldRadiusPx ?? Math.max(width, height) / 2) / geom.pxPerArcsec : 0;
  const targetRadiusArcsec = geom ? geom.targetPx / 2 / geom.pxPerArcsec : 0;
  const maxPan = Math.max(fieldRadiusArcsec, targetRadiusArcsec + fieldRadiusArcsec * 0.5);
  const setPan = (x: number, y: number) => {
    const r = Math.hypot(x, y);
    const k = r > maxPan ? maxPan / r : 1;
    pendingPan.current = { x: x * k, y: y * k };
    if (panFrame.current) return;
    panFrame.current = requestAnimationFrame(() => {
      panFrame.current = 0;
      const p = pendingPan.current;
      pendingPan.current = null;
      if (p) onPanChange?.(p);
    });
  };
  const panHandlers =
    onPanChange && geom
      ? {
          tabIndex: 0,
          onPointerDown: (e: React.PointerEvent) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, start: pan ?? { x: 0, y: 0 } };
            setHover(undefined);
          },
          onPointerMove: (e: React.PointerEvent) => {
            const d = drag.current;
            if (!d) {
              // Identify mode: name what is under the pointer.
              if (explorer?.identify && viewGeom && e.pointerType === "mouse") {
                const p = pointIn(e);
                const label = nameOf(identifyAt(p.x, p.y, viewGeom, placed, companionMarks, explorer.object.rings, surface?.rings));
                setHover((prev) => (label ? (prev?.label === label && Math.hypot(prev.x - p.x, prev.y - p.y) < 6 ? prev : { ...p, label }) : undefined));
              }
              return;
            }
            if (!geom) return;
            // Screen movement back to sky orientation (each orientation is its own inverse).
            const m = orient(orientation, e.clientX - d.x, e.clientY - d.y);
            setPan(d.start.x + m.x / geom.pxPerArcsec, d.start.y + m.y / geom.pxPerArcsec);
          },
          onPointerUp: (e: React.PointerEvent) => {
            const d = drag.current;
            drag.current = null;
            // A click (not a drag) in identify mode picks what is there.
            if (d && explorer?.identify && viewGeom && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) {
              const p = pointIn(e);
              const sel = identifyAt(p.x, p.y, viewGeom, placed, companionMarks, explorer.object.rings, surface?.rings);
              if (sel) explorer.onSelect(sel);
            }
          },
          onPointerLeave: () => setHover(undefined),
          onPointerCancel: () => (drag.current = null),
          onKeyDown: (e: React.KeyboardEvent) => {
            const step = (geom!.spanArcsec || 1) * 0.05;
            const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (!dir) return;
            e.preventDefault();
            const m = orient(orientation, dir[0] * step, dir[1] * step);
            const p = pendingPan.current ?? pan ?? { x: 0, y: 0 };
            setPan(p.x + m.x, p.y + m.y);
          },
        }
      : {};

  const fieldLabel =
    result.framing.shape === "circle"
      ? `Field ${formatAngleArcsec(result.framing.fieldDiameterArcsec)}`
      : `Field ${formatAngleArcsec(result.framing.fieldWidthArcsec / settings.zoom)} × ${formatAngleArcsec(result.framing.fieldHeightArcsec / settings.zoom)}`;

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && !compact && (
        // Above the view, so nothing covers the sky.
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {badge}
            {reference ? (
              <>
                <ProvenanceBadge kind="retrieved" />
                <ProvenanceBadge kind="illustrative" />
                <span className="truncate text-[11px] text-muted">{visual ? "Catalogue stars + survey image" : "Real image, degraded to your setup"}</span>
              </>
            ) : (
              <>
                <ProvenanceBadge kind="illustrative" />
                <span className="text-[11px] text-muted">{referenceState.status === "loading" ? "Loading reference image…" : "Schematic, not imagery"}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
            {starInfo && (
              <span title="Catalogue stars brighter than this setup's estimated limiting magnitude">
                {starInfo.shown} stars · to mag {starInfo.limit.toFixed(1)}
              </span>
            )}
            <span className="rounded bg-surface-sunken/70 px-1.5 py-0.5">{fieldLabel}</span>
          </div>
        </div>
      )}
      <div className="relative mx-auto" style={{ width: width || undefined, height: height || undefined }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${result.mode === "eyepiece" ? "Eyepiece" : "Camera"} view of ${target.name}. ${fieldLabel}.${onPanChange ? " Drag or use the arrow keys to move the telescope." : ""}`}
          style={{ width, height, transform: ORIENTATION_CSS[orientation], filter: display ? displayFilter(display) : undefined, touchAction: onPanChange ? "none" : undefined }}
          data-view-canvas
          {...panHandlers}
          className={`block ${result.mode === "camera" ? "rounded-sm border border-border" : "rounded-full shadow-[0_0_0_1px_rgba(108,123,255,0.25),0_0_60px_-10px_rgba(81,98,255,0.35)]"} ${stale ? "opacity-40" : ""} ${onPanChange ? `${explorer?.identify ? "cursor-crosshair" : "cursor-grab"} outline-none active:cursor-grabbing` : ""}`}
        />
        {width > 0 && !compact && geom && (
          <ViewLayersOverlay
            width={width}
            height={height}
            geom={geom}
            panPx={panPx ?? { x: 0, y: 0 }}
            orientation={orientation}
            showLayer={showLayer}
            equatorial={equatorial}
            otherField={otherField}
            targetName={target.name}
            circle={result.mode === "eyepiece"}
          />
        )}
        {width > 0 && !compact && (
          <>

            {explorer && !stale && (
              <FeatureAnnotationLayer
                explorer={explorer}
                placed={placed}
                rings={placedRings}
                ringScalePx={geom ? geom.targetPx / 2 : 0}
                marks={showLayer("labels") ? companionMarks : []}
                hover={hover}
              />
            )}
            {showLayer("labels") &&
              placeLabels(marks.filter((m) => !companionMarks.some((c) => c.name === m.name))).map((m) => {
                const p = orient(orientation, m.x + (panPx?.x ?? 0), m.y + (panPx?.y ?? 0));
                return (
                  <span
                    key={m.name}
                    className="pointer-events-none absolute -translate-x-1/2 text-[10px] leading-none text-foreground/55"
                    style={{ left: width / 2 + p.x, top: height / 2 + p.y + m.dy }}
                  >
                    {m.name}
                  </span>
                );
              })}
            {tools && <div className="absolute bottom-2 right-2 z-10 flex gap-1.5" data-no-snapshot>{tools}</div>}
            {scaleBar && showLayer("scale") && (
              <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col items-start gap-1">
                <div className="h-px bg-foreground/80" style={{ width: scaleBar.px }} />
                <span className="font-mono text-[11px] text-foreground/80">{scaleBar.label}</span>
              </div>
            )}
            {overlay && !stale && (
              // Only the message itself takes clicks, so the view's tools stay usable.
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 [&>*]:pointer-events-auto">{overlay}</div>
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
          outside={unseen.outside}
          faint={unseen.faint}
        />
      )}
      {reference && !compact && <ReferenceCredit meta={reference.meta} />}
      {visual && !compact && (
        // One line, like the image credit; the full credit and method open below.
        <details className="mt-1 text-xs text-muted">
          <summary className="cursor-pointer truncate">
            Stars: ESA Gaia DR3, Tycho-2, Hipparcos ·{" "}
            <a href={STAR_LICENSE_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              {STAR_LICENSE}
            </a>
          </summary>
          <p className="mt-2 rounded bg-surface p-3">
            {STAR_CREDIT} Stars are drawn to the estimated limiting magnitude of your aperture; colour is shown only for stars
            bright enough for the eye to perceive it (estimated).
          </p>
        </details>
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
  faint,
}: {
  planet: string;
  observedAt: string;
  onChange?: (iso: string) => void;
  notes: string[];
  outside: string[];
  /** In the field but below this setup's limiting magnitude. */
  faint?: string[];
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
          {[
            ...notes,
            ...(outside.length ? [`${outside.join(", ")} ${outside.length === 1 ? "is" : "are"} outside this field of view`] : []),
            ...(faint?.length ? [`${faint.join(", ")} ${faint.length === 1 ? "is" : "are"} too faint to see with this setup`] : []),
          ].join(" · ")}.
        </p>
      )}
      <p className="text-subtle">
        North up, west to the right, as on the sky. A star diagonal mirrors this and a straight-through telescope turns
        it upside down. {planet === "Saturn" ? SATURN_MOON_METHOD : SATELLITE_METHOD}
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

/** Labels, compass, coordinate grid and the other instrument's field, drawn over the view (SVG). */
function ViewLayersOverlay({
  width,
  height,
  geom,
  panPx,
  orientation,
  showLayer,
  equatorial,
  otherField,
  targetName,
  circle,
}: {
  width: number;
  height: number;
  geom: { pxPerArcsec: number; spanArcsec: number; fieldRadiusPx?: number; targetPx: number };
  panPx: { x: number; y: number };
  orientation: "sky" | "diagonal" | "inverted";
  showLayer: (k: keyof ViewLayers) => boolean;
  equatorial?: { raDeg: number; decDeg: number };
  otherField?: Props["otherField"];
  targetName: string;
  circle: boolean;
}) {
  const cx = width / 2;
  const cy = height / 2;
  const at = (x: number, y: number) => {
    const p = orient(orientation, x, y);
    return { x: cx + p.x, y: cy + p.y };
  };
  const clipId = `view-clip-${circle ? "c" : "r"}`;
  const hw = circle ? geom.fieldRadiusPx! : width / 2;
  const hh = circle ? geom.fieldRadiusPx! : height / 2;
  const grid = showLayer("grid") && equatorial ? skyGrid({ ...equatorial, pxPerArcsec: geom.pxPerArcsec, centreOffsetPx: panPx, halfWidthPx: hw, halfHeightPx: hh }) : [];
  const label = at(panPx.x, panPx.y + Math.max(10, geom.targetPx / 2) + 12);
  const compassAt = { x: 30, y: 74 };
  // Locator: when the target is bigger than the field, where the field is on it.
  const fieldR = circle ? geom.fieldRadiusPx! : Math.min(width, height) / 2;
  const targetR = geom.targetPx / 2;
  const locator = targetR > fieldR * 1.1 ? { r: 26, k: 26 / targetR, x: width - 38, y: 40 } : undefined;
  const n = orient(orientation, 0, -1);
  const e = orient(orientation, -1, 0);
  return (
    <svg className="pointer-events-none absolute inset-0" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden data-view-overlay>
      <defs>
        <clipPath id={clipId}>{circle ? <circle cx={cx} cy={cy} r={geom.fieldRadiusPx} /> : <rect x={0} y={0} width={width} height={height} />}</clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} fontFamily="ui-monospace, monospace" fontSize={10}>
        {grid.map((l) => {
          const a = l.kind === "dec" ? at(-hw, l.pos) : at(l.pos, -hh);
          const b = l.kind === "dec" ? at(hw, l.pos) : at(l.pos, hh);
          // Label inside the field, near its left (Dec) or bottom (RA) edge in sky orientation.
          const edge = circle ? Math.sqrt(Math.max(0, hw * hw - l.pos * l.pos)) : l.kind === "dec" ? hw : hh;
          const t = l.kind === "dec" ? at(-edge + 8, l.pos - 3) : at(l.pos + 3, edge - 8);
          return (
            <g key={`${l.kind}${l.label}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(140,160,255,0.35)" strokeWidth={1} strokeDasharray="4 4" />
              <text x={t.x} y={t.y} fill="rgba(170,185,255,0.85)" textAnchor={l.kind === "dec" ? (orientation === "sky" ? "start" : "end") : "start"}>
                {l.label}
              </text>
            </g>
          );
        })}
        {showLayer("otherField") && otherField && (
          <g stroke="rgba(242,180,76,0.85)" fill="none" strokeWidth={1.5} strokeDasharray="6 4">
            {otherField.shape === "circle" ? (
              <circle cx={cx} cy={cy} r={(otherField.diameterArcsec / 2) * geom.pxPerArcsec} />
            ) : (
              <rect
                x={cx - (otherField.widthArcsec / 2) * geom.pxPerArcsec}
                y={cy - (otherField.heightArcsec / 2) * geom.pxPerArcsec}
                width={otherField.widthArcsec * geom.pxPerArcsec}
                height={otherField.heightArcsec * geom.pxPerArcsec}
              />
            )}
            <text
              x={cx}
              y={cy - (otherField.shape === "circle" ? (otherField.diameterArcsec / 2) * geom.pxPerArcsec : (otherField.heightArcsec / 2) * geom.pxPerArcsec) - 5}
              fill="rgba(242,180,76,0.95)"
              stroke="none"
              textAnchor="middle"
              fontSize={11}
            >
              {otherField.label}
            </text>
          </g>
        )}
        {showLayer("labels") && (
          <text x={label.x} y={label.y} fill="rgba(232,235,247,0.8)" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={11}>
            {targetName}
          </text>
        )}
      </g>
      {locator && (
        <g aria-hidden>
          <rect x={locator.x - 34} y={locator.y - 32} width={68} height={70} rx={8} fill="rgba(4,6,13,0.72)" stroke="rgba(108,123,255,0.35)" />
          <circle cx={locator.x} cy={locator.y} r={locator.r} fill="rgba(200,200,210,0.18)" stroke="rgba(232,235,247,0.6)" />
          {(() => {
            // The field centre is at −pan from the target's centre (then oriented like the view).
            const p = orient(orientation, -panPx.x * locator.k, -panPx.y * locator.k);
            const fr = Math.max(2.5, fieldR * locator.k);
            return circle ? (
              <circle cx={locator.x + p.x} cy={locator.y + p.y} r={fr} fill="rgba(108,123,255,0.25)" stroke="#8b96ff" strokeWidth={1.5} />
            ) : (
              <rect
                x={locator.x + p.x - (width / 2) * locator.k}
                y={locator.y + p.y - (height / 2) * locator.k}
                width={Math.max(4, width * locator.k)}
                height={Math.max(3, height * locator.k)}
                fill="rgba(108,123,255,0.25)"
                stroke="#8b96ff"
                strokeWidth={1.5}
              />
            );
          })()}
          <text x={locator.x} y={locator.y + 35} textAnchor="middle" fontSize={9} fontFamily="system-ui, sans-serif" fill="rgba(232,235,247,0.7)">
            Your field
          </text>
        </g>
      )}
      {showLayer("compass") && (
        <g stroke="rgba(232,235,247,0.85)" strokeWidth={1.5} fill="rgba(232,235,247,0.9)" fontSize={11} fontFamily="system-ui, sans-serif">
          <circle cx={compassAt.x} cy={compassAt.y} r={2} stroke="none" />
          <line x1={compassAt.x} y1={compassAt.y} x2={compassAt.x + n.x * 20} y2={compassAt.y + n.y * 20} />
          <line x1={compassAt.x} y1={compassAt.y} x2={compassAt.x + e.x * 20} y2={compassAt.y + e.y * 20} />
          <text x={compassAt.x + n.x * 29} y={compassAt.y + n.y * 29 + 4} textAnchor="middle" stroke="none">N</text>
          <text x={compassAt.x + e.x * 29} y={compassAt.y + e.y * 29 + 4} textAnchor="middle" stroke="none">E</text>
        </g>
      )}
    </svg>
  );
}
