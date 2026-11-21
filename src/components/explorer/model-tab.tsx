"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs } from "@/components/ui/tabs";
import { craterMetrics, loadTerrain, type CraterMetrics, type Terrain } from "@/modules/explorer/terrain";
import type { SurfaceFeature } from "@/modules/explorer/types";
import type { ExplorerContext } from "./explorer-context";
import { SourceList } from "./shared";
import { CrossSection, TopographicMap } from "./terrain-2d";
import { PlanetModelTab } from "./planet-model-tab";
import type { TerrainLayers } from "./terrain-scene";

function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex size-full items-center justify-center">
      <div className="size-9 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
    </div>
  );
}

const GlobeScene = dynamic(() => import("./globe-scene"), { ssr: false, loading: () => <Loading label="Loading 3D globe" /> });
const TerrainScene = dynamic(() => import("./terrain-scene"), { ssr: false, loading: () => <Loading label="Loading 3D terrain" /> });

class WebglBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="flex size-full items-center justify-center p-6 text-center text-sm text-muted">3D needs WebGL, which is not available here. The topographic map and cross-section still work.</p>
    ) : (
      this.props.children
    );
  }
}

/** Says plainly what a 3D view is, and whether its relief is stretched. */
function ReconstructionNote({ exaggeration, what }: { exaggeration: number; what: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <ProvenanceBadge kind="illustrative" />
      <span className="text-muted">Scientific reconstruction from {what}, not the eyepiece image.</span>
      {exaggeration !== 1 && (
        <span className="rounded border border-prov-estimated/50 bg-prov-estimated/15 px-1.5 py-0.5 font-medium text-prov-estimated" data-testid="exaggeration-badge">
          Elevation exaggerated {exaggeration}×
        </span>
      )}
    </div>
  );
}

function Exaggeration({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      Vertical exaggeration
      <input type="range" min={1} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-accent" aria-label="Vertical exaggeration" />
      <span className="w-8 font-mono text-foreground">{value}×</span>
    </label>
  );
}

type ModelView = "terrain" | "globe";

export function ModelTab({ ctx }: { ctx: ExplorerContext }) {
  if (ctx.object.projection !== "selenographic") return <PlanetModelTab ctx={ctx} />;
  return <LunarModelTab ctx={ctx} />;
}

function LunarModelTab({ ctx }: { ctx: ExplorerContext }) {
  const { object, selection } = ctx;
  const feature = selection.kind === "feature" ? object.features.find((f) => f.id === selection.id) : undefined;
  const canTerrain = Boolean(feature?.terrain && object.visualizations.includes("terrain3d"));
  const [view, setView] = useState<ModelView>(canTerrain ? "terrain" : "globe");
  const shown: ModelView = canTerrain ? view : "globe";
  return (
    <div className="space-y-3">
      {canTerrain && (
        <Tabs<ModelView>
          label="3D view"
          variant="segmented"
          value={shown}
          onChange={setView}
          items={[
            { id: "terrain", label: `${feature!.name} terrain` },
            { id: "globe", label: "Whole Moon" },
          ]}
        />
      )}
      {shown === "terrain" && feature ? <TerrainExplorer key={feature.id} feature={feature} /> : <GlobeExplorer ctx={ctx} feature={feature} />}
    </div>
  );
}

function GlobeExplorer({ ctx, feature }: { ctx: ExplorerContext; feature?: SurfaceFeature }) {
  const [exaggeration, setExaggeration] = useState(1);
  const [tonight, setTonight] = useState(true);
  const [labels, setLabels] = useState(true);
  return (
    <div className="space-y-2">
      <div className="relative h-[340px] overflow-hidden rounded-xl border border-border bg-[#04050b]" data-testid="globe-3d">
        <WebglBoundary>
          <GlobeScene
            features={ctx.object.features}
            selectedId={feature?.id}
            orientation={ctx.orientation}
            exaggeration={exaggeration}
            tonightLight={tonight}
            showLabels={labels}
            onSelect={(id) => ctx.onSelect({ kind: "feature", id })}
          />
        </WebglBoundary>
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-white/60">
          <Icons.Rotate className="mr-1 inline size-3.5" />
          Drag to rotate · scroll to zoom · click a marker
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={tonight} onChange={(e) => setTonight(e.target.checked)} className="accent-accent" />
          Sunlight at the observation time
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-accent" />
          Labels
        </label>
      </div>
      <Exaggeration value={exaggeration} onChange={setExaggeration} max={20} />
      <ReconstructionNote exaggeration={exaggeration} what="LRO camera images and LOLA laser altimetry" />
      <SourceList ids={["svsMoonKit", "gazetteer", "meeus"]} />
    </div>
  );
}

type TerrainView = "3d" | "topo" | "section" | "rays";

function TerrainExplorer({ feature }: { feature: SurfaceFeature }) {
  const [terrain, setTerrain] = useState<Terrain>();
  const [metrics, setMetrics] = useState<CraterMetrics>();
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<TerrainView>("3d");
  const [exaggeration, setExaggeration] = useState(1);
  const [azimuth, setAzimuth] = useState(90);
  const [layers, setLayers] = useState<TerrainLayers>({ rim: true, peak: true, imagery: true, surroundings: true });
  useEffect(() => {
    let cancelled = false;
    loadTerrain(feature.id).then(
      (t) => {
        if (cancelled) return;
        setTerrain(t);
        if (feature.type === "Crater") setMetrics(craterMetrics(t, feature.diameterKm));
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [feature]);

  if (failed) return <p className="text-sm text-danger">The elevation data could not be loaded.</p>;
  if (!terrain) return <div className="h-[340px]"><Loading label="Loading elevation data" /></div>;

  const isCrater = feature.type === "Crater";
  const toggles: [keyof TerrainLayers, string][] = [
    ...(isCrater ? ([["rim", "Crater rim"], ["peak", "Central peak"]] as [keyof TerrainLayers, string][]) : []),
    ["imagery", isCrater ? "Ejecta rays (LROC image)" : "LROC image"],
    ["surroundings", "Surrounding terrain"],
  ];
  return (
    <div className="space-y-2">
      <Tabs<TerrainView>
        label="Terrain view"
        variant="segmented"
        className="flex w-full [&>button]:flex-1"
        value={view}
        onChange={setView}
        items={[
          { id: "3d", label: "3D View" },
          { id: "topo", label: "Topographic" },
          { id: "section", label: "Cross-section" },
          { id: "rays", label: "Image" },
        ]}
      />
      {view === "3d" && (
        <>
          <div className="relative grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative h-[320px] overflow-hidden rounded-xl border border-border bg-[#04050b]" data-testid="terrain-3d">
              <WebglBoundary>
                <TerrainScene terrain={terrain} metrics={metrics} diameterKm={feature.diameterKm} exaggeration={exaggeration} layers={layers} />
              </WebglBoundary>
              <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/60">
                <Icons.Rotate className="mr-1 inline size-3.5" />
                Drag to rotate · scroll to zoom
              </p>
            </div>
            <fieldset className="flex flex-row flex-wrap gap-x-3 gap-y-1.5 self-start rounded-xl border border-border bg-surface-sunken/60 p-2.5 text-xs sm:flex-col">
              <legend className="sr-only">Layers</legend>
              {toggles.map(([k, label]) => (
                <label key={k} className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} className="accent-accent" />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
          <Exaggeration value={exaggeration} onChange={setExaggeration} max={5} />
          <ReconstructionNote exaggeration={exaggeration} what="LOLA laser altimetry (118 m grid) and the LROC WAC mosaic" />
          {!layers.imagery && <p className="text-[11px] text-muted">Plain relief: shading from the measured topography only, lit from the east for clarity (illustrative lighting).</p>}
        </>
      )}
      {view === "topo" && <TopographicMap terrain={terrain} />}
      {view === "section" && (
        <div className="space-y-3">
          <CrossSection terrain={terrain} metrics={metrics} azimuthDeg={azimuth} onAzimuthChange={setAzimuth} />
          <div className="mx-auto max-w-[220px]">
            <TopographicMap terrain={terrain} azimuthDeg={azimuth} />
          </div>
        </div>
      )}
      {view === "rays" && (
        <figure className="space-y-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={terrain.albedoSrc} alt={`LROC WAC image of ${feature.name} and its surroundings`} className="aspect-square w-full rounded-xl border border-border object-cover" />
          <figcaption className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <ProvenanceBadge kind="retrieved" />
            Real orbital imagery: LRO Wide Angle Camera, 100 m per pixel (NASA/GSFC/Arizona State University). North up, {terrain.sideKm} km across.
            {isCrater && " Bright ejecta and rays are fresh material that space weathering has not yet darkened."}
          </figcaption>
        </figure>
      )}
      {metrics && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Depth", `${(metrics.depthM / 1000).toFixed(1)} km`],
            ["Rim diameter", `${Math.round(metrics.rimRadiusKm * 2)} km`],
            ["Central peak", metrics.centralPeakM !== undefined ? `${(metrics.centralPeakM / 1000).toFixed(1)} km` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-surface-sunken/60 px-2 py-1.5">
              <dt className="text-[10px] text-muted">{k}</dt>
              <dd className="font-mono text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {metrics && <p className="text-[11px] text-subtle">Calculated here: {metrics.method}</p>}
      <SourceList ids={["lolaLdem118", "wac100m", "gazetteer"]} />
    </div>
  );
}
