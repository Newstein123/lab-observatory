"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EquipmentViewer, rigItem, type MountPose, type PartId } from "@/components/equipment-3d";
import { tubeStyle } from "@/components/equipment-3d/dimensions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/fields";
import { Knob } from "@/components/ui/knob";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs } from "@/components/ui/tabs";
import { ArButton } from "@/components/ar/ar-button";
import { BalanceBar, StarTest } from "./workbench-widgets";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { describeAccessory } from "@/modules/equipment/models";
import { partGuide } from "@/modules/lab/part-guide";
import {
  errorFromFocusOffset,
  FOCUS_TOLERANCE_MM,
  focusOffsetFromError,
  focusTargetMm,
  POLAR_OK_DEG,
  polarDriftArcsecPerMin,
  polarErrorDeg,
  raBalance,
  type TrainMode,
  type TrainParts,
} from "@/modules/lab/workbench";
import { telescopeOpticsSchema } from "@/modules/simulations/engine";

/** Drawtube travel, mm (matches the 3D focuser). */
const TRAVEL_MM = 60;

type Tab = "parts" | "focus" | "align";

export interface WorkbenchProps {
  open: boolean;
  onClose: () => void;
  config: ConfigurationSpec;
  /** Taking the Barlow or filter out (or back in) updates the configuration. */
  onConfigChange?: (c: ConfigurationSpec) => void;
  mode: TrainMode;
  onModeChange?: (m: TrainMode) => void;
  /** The simulation's focus offset (0 = sharp); turning the focus knob updates it. */
  focusOffset?: number;
  onFocusOffsetChange?: (v: number) => void;
}

/**
 * A hands-on view of the whole setup: click parts to learn what they do, take
 * accessories in and out, focus, and (on an equatorial mount) polar align and
 * balance. Only the Barlow/filter fitting, eyepiece/camera choice and focus
 * feed back into the configuration and simulation; alignment is practice.
 */
export function TelescopeWorkbench(props: WorkbenchProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={`Workbench · ${props.config.name}`} full>
      {props.open && <WorkbenchBody {...props} />}
    </Dialog>
  );
}

function WorkbenchBody({ config, onConfigChange, mode: modeIn, onModeChange, focusOffset, onFocusOffsetChange }: WorkbenchProps) {
  const style = tubeStyle(config.telescope);
  const validOptics = telescopeOpticsSchema.safeParse(config.telescope).success;

  // What is fitted. Parts taken out are remembered so they can go back in.
  const [mode, setModeLocal] = useState<TrainMode>(modeIn);
  const [topIn, setTopIn] = useState(true);
  const stash = useRef({ barlow: config.barlow, filter: config.filter });
  if (config.barlow) stash.current.barlow = config.barlow;
  if (config.filter) stash.current.filter = config.filter;
  const [barlowIn, setBarlowIn] = useState(Boolean(config.barlow));
  const [filterIn, setFilterIn] = useState(Boolean(config.filter));
  const parts: TrainParts = { mode, barlow: barlowIn, filter: filterIn, top: topIn };
  const full = { ...config, barlow: stash.current.barlow, filter: stash.current.filter };

  const setMode = (m: TrainMode) => {
    setModeLocal(m);
    setTopIn(true);
    onModeChange?.(m);
  };
  const fit = (part: "barlow" | "filter", inserted: boolean) => {
    (part === "barlow" ? setBarlowIn : setFilterIn)(inserted);
    onConfigChange?.({ ...config, [part]: inserted ? stash.current[part] : undefined });
  };

  // Focus: start a little out unless the simulation says otherwise.
  const target = focusTargetMm(parts);
  const [focusMm, setFocusMm] = useState(() => clampFocus(target + (focusOffset ? errorFromFocusOffset(focusOffset) : 11)));
  const focusError = focusMm - target;
  const sharp = Math.abs(focusError) <= FOCUS_TOLERANCE_MM;
  const setFocus = (v: number) => {
    setFocusMm(v);
    onFocusOffsetChange?.(focusOffsetFromError(v - target));
  };
  // Swapping parts moves the focal plane: report the new state to the simulation.
  const lastTarget = useRef(target);
  useEffect(() => {
    if (lastTarget.current === target) return;
    lastTarget.current = target;
    onFocusOffsetChange?.(focusOffsetFromError(focusMm - target));
  }, [target, focusMm, onFocusOffsetChange]);

  // Mount: deliberately misaligned and unbalanced to begin with.
  const [siteLat, setSiteLat] = useState(40);
  const [pose, setPose] = useState<Required<Pick<MountPose, "latitudeDeg" | "polarAzimuthDeg" | "raDeg" | "decDeg" | "counterweight" | "altitudeDeg" | "azimuthDeg">>>(() => ({
    latitudeDeg: 28,
    polarAzimuthDeg: 9,
    raDeg: 90,
    decDeg: 84,
    // At the end of the shaft away from the balance point, so there is something to do.
    counterweight: config.mount?.type === "equatorial" && validOptics ? ((raBalance(full, config.mount, parts, 0.5).idealPosition ?? 0.5) < 0.5 ? 1 : 0) : 0.5,
    altitudeDeg: 40,
    azimuthDeg: 0,
  }));
  const set = (patch: Partial<typeof pose>) => setPose((p) => ({ ...p, ...patch }));
  const mount = config.mount;
  const eq = mount?.type === "equatorial";

  // The pole's height above the horizon is the latitude, north or south.
  const poleAlt = Math.abs(siteLat);
  const polarError = polarErrorDeg(pose.latitudeDeg, poleAlt, pose.polarAzimuthDeg);
  const aligned = polarError <= POLAR_OK_DEG;
  const balance = eq && validOptics ? raBalance(full, mount, parts, pose.counterweight) : undefined;
  const shaftHorizontal = Math.abs(pose.raDeg - 90) < 3;

  const [tab, setTab] = useState<Tab>("parts");
  const [selected, setSelected] = useState<PartId>();
  const guide = selected ? partGuide(selected, style) : undefined;

  const item = useMemo(
    () =>
      rigItem(
        full,
        { mode, barlow: barlowIn, filter: filterIn, top: topIn },
        {
          focusMm: style === "sct" || style === "maksutov" ? 20 : focusMm,
          pose: { ...pose, counterweights: balance?.counterweights ?? 1 },
          focusPart: tab === "focus" ? "focuser" : undefined,
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `full` is rebuilt every render from these
    [config, mode, barlowIn, filterIn, topIn, focusMm, pose, balance?.counterweights, tab, style],
  );

  const steps = [
    { label: mode === "visual" ? "Eyepiece in the focuser" : "Camera in the focuser", done: topIn && Boolean(mode === "visual" ? config.eyepiece : config.camera) },
    { label: "In focus", done: topIn && sharp },
    ...(eq ? [{ label: "Polar aligned", done: aligned }, { label: "Balanced in RA", done: balance?.state === "balanced" }] : []),
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
      {/* 3D */}
      <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_50%_75%,rgba(81,98,255,0.18),transparent_65%)] lg:h-full">
        {validOptics ? (
          <EquipmentViewer
            item={item}
            autoRotate={false}
            label={`3D workbench: ${config.name}`}
            className="h-[42vh] lg:h-full"
            onSelectPart={(id) => {
              setSelected(id);
              setTab("parts");
            }}
            selectedPart={selected}
            selectedLabel={guide?.name}
            poleGuide={eq && tab === "align" ? { siteLatitudeDeg: poleAlt } : undefined}
          />
        ) : (
          <p className="p-8 text-center text-sm text-muted">Enter a valid aperture and focal length to build the telescope.</p>
        )}
        <p className="pointer-events-none absolute top-3 left-3 rounded bg-black/60 px-2 py-1 text-[11px] text-muted">
          Drag to orbit · scroll to zoom · click a part to learn about it
        </p>
        {validOptics && (
          <ArButton
            spec={{
              ...config,
              barlow: barlowIn ? stash.current.barlow : undefined,
              filter: filterIn ? stash.current.filter : undefined,
              eyepiece: topIn ? config.eyepiece : undefined,
              camera: topIn ? config.camera : undefined,
            }}
            mode={mode}
            className="absolute top-3 right-3"
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
        <ol className="grid grid-cols-2 gap-1.5" aria-label="Setup checklist">
          {steps.map((s) => (
            <li
              key={s.label}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${s.done ? "border-success/40 bg-success/10 text-foreground" : "border-border text-muted"}`}
            >
              <span aria-hidden className={s.done ? "text-success" : "text-subtle"}>
                {s.done ? "✓" : "○"}
              </span>
              {s.label}
              <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
            </li>
          ))}
        </ol>

        <Tabs<Tab>
          label="Workbench"
          variant="segmented"
          value={tab}
          onChange={setTab}
          items={[
            { id: "parts", label: "Parts" },
            { id: "focus", label: "Focus" },
            { id: "align", label: mount ? (eq ? "Align & balance" : "Point") : "Mount" },
          ]}
        />

        {tab === "parts" && (
          <div className="space-y-3">
            <section className="rounded-xl border border-border bg-surface-sunken/50 p-3" aria-live="polite">
              {guide ? (
                <>
                  <h3 className="font-semibold">{guide.name}</h3>
                  <p className="mt-1 text-sm text-muted">{guide.what}</p>
                  <p className="mt-2 text-xs text-foreground/80">
                    <span className="font-medium text-accent">Tip · </span>
                    {guide.tip}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">Click any part of the telescope to see what it does and how to use it.</p>
              )}
            </section>

            <section aria-label="In the focuser" className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">In the focuser</h3>
              <FitRow
                name="Eyepiece"
                detail={config.eyepiece ? (config.eyepiece.label ?? describeAccessory({ kind: "eyepiece", spec: config.eyepiece })) : undefined}
                fitted={mode === "visual" && topIn}
                onToggle={() => (mode === "visual" ? setTopIn(!topIn) : setMode("visual"))}
                insertLabel={mode === "imaging" ? "Swap in (removes camera)" : "Insert"}
                onLearn={() => setSelected("eyepiece")}
              />
              <FitRow
                name="Camera"
                detail={config.camera ? (config.camera.label ?? describeAccessory({ kind: "camera", spec: config.camera })) : undefined}
                fitted={mode === "imaging" && topIn}
                onToggle={() => (mode === "imaging" ? setTopIn(!topIn) : setMode("imaging"))}
                insertLabel={mode === "visual" ? "Swap in (removes eyepiece)" : "Insert"}
                onLearn={() => setSelected("camera")}
              />
              <FitRow
                name="Barlow lens"
                detail={stash.current.barlow ? (stash.current.barlow.label ?? `${stash.current.barlow.factor}×`) : undefined}
                fitted={barlowIn}
                onToggle={() => fit("barlow", !barlowIn)}
                onLearn={() => setSelected("barlow")}
              />
              <FitRow
                name="Filter"
                detail={stash.current.filter?.name}
                fitted={filterIn}
                onToggle={() => fit("filter", !filterIn)}
                onLearn={() => setSelected("filter")}
              />
              <p className="text-[11px] text-subtle">
                Taking the Barlow or filter out updates your configuration. To fit a different one, choose it in{" "}
                <Link href="/lab/configure?category=eyepiece" className="text-accent hover:underline">
                  Equipment
                </Link>
                .
              </p>
            </section>
          </div>
        )}

        {tab === "focus" && (
          <section className="space-y-3">
            <p className="text-sm text-muted">
              {style === "sct" || style === "maksutov"
                ? "Turn the focus knob on the back of the tube; it moves the main mirror. Watch the star shrink to a point."
                : "Turn the focuser knob to rack the drawtube in or out. Watch the star shrink to a point."}
            </p>
            <div className="flex items-center justify-around gap-4 rounded-xl border border-border bg-surface-sunken/50 p-4">
              <StarTest errorMm={focusError} obstructed={style !== "refractor"} />
              <Knob
                label="Focus knob"
                value={focusMm}
                min={0}
                max={TRAVEL_MM}
                step={0.2}
                sensitivity={0.08}
                turns={6}
                onChange={setFocus}
                format={(v) => (style === "sct" || style === "maksutov" ? `${(v * 6).toFixed(0)}° turned` : `drawtube ${v.toFixed(1)} mm out`)}
                tone={sharp ? "good" : "default"}
                size={88}
              />
            </div>
            <p className={`text-sm font-medium ${sharp ? "text-success" : "text-muted"}`} role="status">
              {!topIn
                ? `Put the ${mode === "visual" ? "eyepiece" : "camera"} in first.`
                : sharp
                  ? "Sharp. The star is as small as the seeing allows."
                  : Math.abs(focusError) < 6
                    ? "Nearly there; small turns now."
                    : "Out of focus: the star is a blurred disc."}
            </p>
            <p className="text-xs text-muted">
              Cameras and Barlows move the focal plane, so you will need to refocus after swapping them.
              {onFocusOffsetChange ? " The simulation's focus follows this knob." : ""}
            </p>
            <p className="flex items-center gap-2 text-[11px] text-subtle">
              <ProvenanceBadge kind="illustrative" /> Focus positions are representative, not a specific focuser.
            </p>
          </section>
        )}

        {tab === "align" && !mount && (
          <p className="text-sm text-muted">
            This configuration has no mount. Choose one in{" "}
            <Link href="/lab/configure?category=mount" className="text-accent hover:underline">
              Equipment
            </Link>{" "}
            to practise setting it up.
          </p>
        )}

        {tab === "align" && mount && !eq && (
          <section className="space-y-3">
            <p className="text-sm text-muted">
              {mount.type === "dobsonian" ? "A Dobsonian" : "An alt-azimuth mount"} moves up/down and left/right. There is nothing to align:
              point and look. Try aiming it.
            </p>
            <div className="flex justify-around rounded-xl border border-border bg-surface-sunken/50 p-4">
              <Knob label="Altitude" value={pose.altitudeDeg} min={5} max={90} onChange={(v) => set({ altitudeDeg: v })} format={(v) => `${v}° up`} />
              <Knob label="Azimuth" value={pose.azimuthDeg} min={-180} max={180} onChange={(v) => set({ azimuthDeg: v })} format={(v) => `${v}°`} turns={1} />
            </div>
          </section>
        )}

        {tab === "align" && eq && balance && (
          <section className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">1 · Polar align</h3>
              <p className="text-xs text-muted">
                Point the polar axis at the celestial pole (the dashed gold line): raise it to your latitude with the latitude bolts, then turn
                it to true north with the azimuth bolts.
              </p>
              <label className="flex items-center gap-2 text-xs text-muted">
                Your latitude
                <input
                  type="number"
                  min={-90}
                  max={90}
                  step={0.1}
                  value={siteLat}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setSiteLat(Math.min(90, Math.max(-90, v)));
                  }}
                  className={`${inputClass} w-24 py-1`}
                />
                °
                {siteLat < 0 && <span className="text-warning">Southern sky: face the polar axis south (shown as north here).</span>}
              </label>
              <div className="flex justify-around rounded-xl border border-border bg-surface-sunken/50 p-3">
                <Knob
                  label="Latitude bolts"
                  value={pose.latitudeDeg}
                  min={0}
                  max={90}
                  step={0.1}
                  sensitivity={0.05}
                  onChange={(v) => set({ latitudeDeg: v })}
                  format={(v) => `${v.toFixed(1)}° up`}
                  tone={Math.abs(pose.latitudeDeg - poleAlt) < 0.4 ? "good" : "default"}
                />
                <Knob
                  label="Azimuth bolts"
                  value={pose.polarAzimuthDeg}
                  min={-20}
                  max={20}
                  step={0.1}
                  sensitivity={0.04}
                  onChange={(v) => set({ polarAzimuthDeg: v })}
                  format={(v) => (Math.abs(v) < 0.05 ? "due north" : `${Math.abs(v).toFixed(1)}° ${v > 0 ? "east" : "west"}`)}
                  tone={Math.abs(pose.polarAzimuthDeg) < 0.4 ? "good" : "default"}
                />
              </div>
              <Readout
                ok={aligned}
                title={aligned ? "Polar aligned" : `Polar axis is ${polarError.toFixed(1)}° off the pole`}
                detail={`Stars drift up to ${polarDriftArcsecPerMin(polarError).toFixed(1)}″ per minute while tracking.`}
                kind="calculated"
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">2 · Balance in RA</h3>
              <p className="text-xs text-muted">
                Swing the counterweight shaft horizontal, then slide the weight until the telescope stays put with the RA clutch loose.
              </p>
              <div className="flex flex-wrap items-center justify-around gap-3 rounded-xl border border-border bg-surface-sunken/50 p-3">
                <Button size="sm" onClick={() => set({ raDeg: 90 })} disabled={shaftHorizontal}>
                  {shaftHorizontal ? "Shaft horizontal ✓" : "Swing shaft horizontal"}
                </Button>
                <Knob
                  label="Counterweight"
                  value={pose.counterweight}
                  min={0}
                  max={1}
                  step={0.01}
                  sensitivity={0.004}
                  onChange={(v) => set({ counterweight: v })}
                  format={(v) => `${Math.round(v * 100)}% out`}
                  tone={balance.state === "balanced" ? "good" : "warn"}
                />
              </div>
              <BalanceBar ratio={balance.ratio} />
              <Readout
                ok={balance.state === "balanced"}
                title={
                  balance.state === "balanced"
                    ? "Balanced"
                    : balance.state === "tube-heavy"
                      ? "Tube-heavy: slide the weight out"
                      : "Weight-heavy: slide the weight in"
                }
                detail={`Tube side about ${balance.tubeSideKg.toFixed(1)} kg with what is in the focuser; ${balance.counterweights} × ${(balance.counterweightKg / balance.counterweights).toFixed(1)} kg counterweight${balance.counterweights > 1 ? "s" : ""}. Swapping an eyepiece for a camera changes the balance.`}
                kind="estimated"
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">3 · Move the axes</h3>
              <div className="flex flex-wrap items-center justify-around gap-3 rounded-xl border border-border bg-surface-sunken/50 p-3">
                <Knob label="RA axis" value={pose.raDeg} min={-180} max={180} onChange={(v) => set({ raDeg: v })} format={(v) => `${v}°`} turns={1} />
                <Knob label="Dec axis" value={pose.decDeg} min={-60} max={90} onChange={(v) => set({ decDeg: v })} format={(v) => `dec ${v}°`} />
                <Button size="sm" onClick={() => set({ raDeg: 0, decDeg: 90 })}>
                  Home position
                </Button>
              </div>
              <p className="text-[11px] text-subtle">
                Home: counterweight down, tube pointing at the pole. Mount alignment here is practice and is not saved.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function clampFocus(v: number) {
  return Math.min(TRAVEL_MM, Math.max(0, Math.round(v * 5) / 5));
}

function FitRow({
  name,
  detail,
  fitted,
  onToggle,
  onLearn,
  insertLabel = "Insert",
}: {
  name: string;
  detail?: string;
  fitted: boolean;
  onToggle: () => void;
  onLearn: () => void;
  insertLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${fitted ? "bg-success" : "bg-border-strong"}`} />
      <button type="button" onClick={onLearn} className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">{detail ?? "Not in this configuration"}</span>
      </button>
      {detail && (
        <Button size="sm" variant={fitted ? "secondary" : "primary"} onClick={onToggle}>
          {fitted ? "Remove" : insertLabel}
        </Button>
      )}
    </div>
  );
}

function Readout({ ok, title, detail, kind }: { ok: boolean; title: string; detail: string; kind: "calculated" | "estimated" }) {
  return (
    <div role="status" className={`rounded-lg border px-3 py-2 ${ok ? "border-success/40 bg-success/10" : "border-border bg-surface-sunken/50"}`}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <span aria-hidden className={ok ? "text-success" : "text-warning"}>
          {ok ? "✓" : "●"}
        </span>
        {title}
        <ProvenanceBadge kind={kind} />
      </p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </div>
  );
}

/** "Open in workbench" icon button. */
export function ExpandButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open the telescope workbench"
      title="Open the workbench: learn the parts, focus, align and balance"
      className={`flex size-8 items-center justify-center rounded-lg border border-border bg-background/70 text-muted backdrop-blur transition-colors hover:border-accent hover:text-foreground ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
      </svg>
    </button>
  );
}
