"use client";

/**
 * Hands-on AR (WebXR, e.g. Chrome on ARCore Android phones; headsets with
 * hand tracking also work through the same pointer events). The telescope is
 * placed on the real floor at true size; tapping parts takes accessories in
 * and out, dragging knobs, bolts and axes adjusts them, and a panel overlaid
 * on the camera view (WebXR DOM overlay) explains each part and shows focus,
 * polar alignment and balance.
 *
 * Loaded only when the user asks for it.
 */

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createXRStore, useXR, useXRHitTest, XR, XRDomOverlay } from "@react-three/xr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Box3Helper, Color, Group, Matrix4, Mesh, Vector3 } from "three";
import { rigItem } from "@/components/equipment-3d";
import { tubeStyle } from "@/components/equipment-3d/dimensions";
import { PartContext, type PartId } from "@/components/equipment-3d/parts";
import { StageModel } from "@/components/equipment-3d/stage";
import { BalanceBar, StarTest } from "@/components/lab/workbench-widgets";
import { Knob } from "@/components/ui/knob";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { applyDrag, dragControlFor, DRAG_HINTS, facingYaw, toggleFor, type DragControl, type RigControls } from "@/modules/lab/ar-controls";
import { partAtCentre, visibleLabels, type LabelBox } from "@/modules/lab/ar-labels";
import type { ArSetup } from "@/modules/lab/ar-link";
import { partGuide } from "@/modules/lab/part-guide";
import {
  FOCUS_TOLERANCE_MM,
  focusTargetMm,
  POLAR_OK_DEG,
  polarDriftArcsecPerMin,
  polarErrorDeg,
  raBalance,
} from "@/modules/lab/workbench";

/** Scene units are 100 mm; WebXR is in metres. */
const METRES_PER_UNIT = 0.1;
const FOCUS_TRAVEL_MM = 60;

type Panel = "parts" | "focus" | "align";

export default function InteractiveAr({ setup }: { setup: ArSetup }) {
  const store = useMemo(
    () =>
      createXRStore({
        offerSession: false,
        // A desktop emulator with a synthetic room (localhost, development only).
        emulate: process.env.NODE_ENV === "development" ? "metaQuest3" : false,
        domOverlay: true,
        hitTest: true,
        handTracking: true,
        anchors: false,
        layers: false,
        meshDetection: false,
        planeDetection: false,
      }),
    [],
  );
  const [error, setError] = useState<string>();
  // Development only: lets automated tests drive the emulator.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") (window as unknown as { __arStore?: typeof store }).__arStore = store;
  }, [store]);
  const mountType = setup.mount?.type;
  const style = tubeStyle(setup.telescope);

  // --- What the user has set by hand ---
  const initialTarget = focusTargetMm({ mode: setup.mode, barlow: Boolean(setup.barlow), filter: Boolean(setup.filter), top: true });
  const [controls, setControls] = useState<RigControls>({
    mode: setup.mode,
    topIn: true,
    barlowIn: Boolean(setup.barlow),
    filterIn: Boolean(setup.filter),
    focusMm: Math.min(FOCUS_TRAVEL_MM, initialTarget + 11),
    latitudeDeg: 28,
    polarAzimuthDeg: 9,
    raDeg: 90,
    decDeg: 84,
    counterweight: 0,
    altitudeDeg: 40,
    azimuthDeg: 0,
  });
  const [siteLat, setSiteLat] = useState(40);
  const [placed, setPlaced] = useState<{ position: [number, number, number]; yaw: number }>();
  const [selected, setSelected] = useState<PartId>();
  const [panel, setPanel] = useState<Panel>("parts");
  const [hasFloor, setHasFloor] = useState(false);
  // If no floor is found after a few seconds, offer to place it in front of the viewer.
  const [floorSlow, setFloorSlow] = useState(false);
  const reticle = useRef(new Vector3());
  // Part name tags: the scene projects each registered part to the screen and
  // moves these DOM tags directly every frame (no React re-render per frame).
  const parts = useMemo(() => new Map<PartId, Group>(), []);
  const tags = useMemo(() => new Map<PartId, HTMLElement>(), []);
  const [showLabels, setShowLabels] = useState(true);
  const [looking, setLooking] = useState<PartId>();
  const partIds = useLabelledParts(parts, Boolean(placed));

  const spec = useMemo(() => ({ ...setup, name: setup.name ?? "AR setup", status: "experimental" }) as ConfigurationSpec, [setup]);
  const fitted = { mode: controls.mode, barlow: controls.barlowIn, filter: controls.filterIn, top: controls.topIn };
  const target = focusTargetMm(fitted);
  const focusError = controls.focusMm - target;
  const sharp = controls.topIn && Math.abs(focusError) <= FOCUS_TOLERANCE_MM;
  const eq = mountType === "equatorial";
  const poleAlt = Math.abs(siteLat);
  const polarError = polarErrorDeg(controls.latitudeDeg, poleAlt, controls.polarAzimuthDeg);
  const balance = eq && setup.mount ? raBalance(spec, setup.mount, fitted, controls.counterweight) : undefined;
  const set = (patch: Partial<RigControls>) => setControls((c) => ({ ...c, ...patch }));

  // --- Touch: press a part to grab it, drag a finger to adjust ---
  const grab = useRef<DragControl | null>(null);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const onPress = useCallback(
    (id: PartId) => {
      devRecord("press", id);
      setSelected(id);
      grab.current = dragControlFor(id, mountType) ?? null;
    },
    [mountType],
  );
  const onSelect = useCallback((id: PartId) => {
    devRecord("select", id);
    setSelected(id);
    const toggle = toggleFor(id);
    if (toggle === "top") setControls((c) => ({ ...c, topIn: !c.topIn }));
    if (toggle === "barlow") setControls((c) => ({ ...c, barlowIn: !c.barlowIn }));
    if (toggle === "filter") setControls((c) => ({ ...c, filterIn: !c.filterIn }));
  }, []);

  const enter = async () => {
    setError(undefined);
    try {
      const session = await store.enterAR();
      if (!session) setError("AR could not start on this device.");
    } catch (e) {
      console.error("Hands-on AR failed to start", e);
      setError("AR could not start. Check that Chrome may use the camera, and that Google Play Services for AR is installed.");
    }
  };

  useEffect(
    () =>
      store.onSessionEnd(() => {
        setPlaced(undefined);
        setSelected(undefined);
        setHasFloor(false);
        setFloorSlow(false);
      }),
    [store],
  );
  const session = useXRSession(store);
  useEffect(() => {
    if (!session || placed || hasFloor) return;
    const id = window.setTimeout(() => setFloorSlow(true), 4000);
    return () => window.clearTimeout(id);
  }, [session, placed, hasFloor]);

  const guide = selected ? partGuide(selected, style) : undefined;
  const selectedControl = selected ? dragControlFor(selected, mountType) : undefined;
  const selectedToggle = selected ? toggleFor(selected) : undefined;
  const toggleState = selectedToggle === "top" ? controls.topIn : selectedToggle === "barlow" ? controls.barlowIn : selectedToggle === "filter" ? controls.filterIn : undefined;

  const item = rigItem(spec, fitted, {
    focusMm: style === "sct" || style === "maksutov" ? 20 : controls.focusMm,
    pose: { ...controls, counterweights: balance?.counterweights ?? 1 },
  });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={enter}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent/15 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent/25"
      >
        Set it up with your hands (AR)
      </button>
      <p className="text-center text-xs text-muted">
        Place the telescope on your floor, then tap and drag its parts: focus, swap the eyepiece, polar align and balance.
      </p>
      {error && (
        <p role="alert" className="text-center text-xs text-warning">
          {error}
        </p>
      )}

      {/* The WebXR scene. Invisible on the page; it renders into the AR session. */}
      <div aria-hidden className="pointer-events-none fixed top-0 left-0 size-px overflow-hidden opacity-0">
        {/* XR input (touch, controllers, hands) reaches objects through the XR pointer events. */}
        <Canvas dpr={1} gl={{ antialias: true, alpha: true }} camera={{ near: 0.01, far: 50 }}>
          <XR store={store}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 4, 1]} intensity={1.6} />
            <Environment resolution={128} frames={1}>
              <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
              <Lightformer form="rect" intensity={1.4} position={[-6, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[3, 10, 1]} />
            </Environment>

            <InSession>
              {!placed && <Reticle target={reticle} onFloorChange={setHasFloor} />}
              {placed && (
                <PlacedRig
                  item={item}
                  parts={parts}
                  placed={placed}
                  onPress={onPress}
                  onSelect={onSelect}
                  selected={selected}
                  poleGuide={eq && panel === "align" ? { siteLatitudeDeg: poleAlt } : undefined}
                />
              )}
              <PlaceAction placed={Boolean(placed)} reticle={reticle} onPlace={setPlaced} />
              {placed && <PartLabels parts={parts} tags={tags} show={showLabels} selected={selected} onLook={setLooking} />}
            </InSession>

            <XRDomOverlay
              style={{ position: "fixed", inset: 0, touchAction: "none" }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (t) lastTouch.current = { x: t.clientX, y: t.clientY };
              }}
              onTouchMove={(e) => {
                const t = e.touches[0];
                const prev = lastTouch.current;
                if (!t || !prev) return;
                lastTouch.current = { x: t.clientX, y: t.clientY };
                const control = grab.current;
                if (control) setControls((c) => applyDrag(c, control, t.clientX - prev.x, t.clientY - prev.y, FOCUS_TRAVEL_MM));
              }}
              onTouchEnd={() => {
                grab.current = null;
                lastTouch.current = null;
              }}
            >
              {placed && (
                <LabelLayer
                  ids={partIds}
                  tags={tags}
                  name={(id) => partGuide(id, style).name}
                  looking={looking}
                  selected={selected}
                  onPick={(id) => {
                    setSelected(id);
                    setPanel("parts");
                  }}
                />
              )}
              <ArOverlay>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{setup.name ?? setup.telescope.label ?? "Telescope"}</p>
                  <div className="flex shrink-0 gap-1.5">
                    {placed && (
                      <button
                        type="button"
                        aria-pressed={showLabels}
                        onClick={() => setShowLabels((v) => !v)}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${showLabels ? "border-[#8b96ff] bg-[#5162ff]/30" : "border-white/30"}`}
                      >
                        Labels {showLabels ? "on" : "off"}
                      </button>
                    )}
                    <button type="button" onClick={() => store.getState().session?.end()} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs">
                      Exit AR
                    </button>
                  </div>
                </div>

                {!placed ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm">{hasFloor ? "Floor found. Tap Place to stand the telescope there." : "Point at the floor and move your phone slowly…"}</p>
                    <PlaceButton enabled={hasFloor} />
                    {floorSlow && !hasFloor && (
                      <button type="button" onClick={() => requestPlace?.("front")} className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs">
                        Can&apos;t find the floor? Place it in front of me
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-1.5">
                      {(["parts", "focus", ...(mountType ? ["align"] : [])] as Panel[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPanel(p)}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${panel === p ? "bg-[#5162ff] text-white" : "bg-white/10"}`}
                        >
                          {p === "parts" ? "Parts" : p === "focus" ? "Focus" : eq ? "Align & balance" : "Point"}
                        </button>
                      ))}
                    </div>

                    {panel === "parts" && (
                      <div className="space-y-1.5">
                        {guide ? (
                          <>
                            <p className="text-sm font-semibold">{guide.name}</p>
                            <p className="text-xs text-white/80">{guide.what}</p>
                            {selectedControl && <p className="text-xs text-[#aab3ff]">{DRAG_HINTS[selectedControl]}</p>}
                            {selectedToggle && (
                              <button
                                type="button"
                                onClick={() => onSelect(selected!)}
                                className="rounded-lg bg-[#5162ff] px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                {toggleState ? "Take it out" : "Put it back"}
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-white/80">
                            Tap a part to learn about it. Tap the eyepiece to take it out. Press and drag the focuser, the tube or
                            {eq ? " the counterweight" : " the base"} to move them.
                          </p>
                        )}
                      </div>
                    )}

                    {panel === "focus" && (
                      <div className="flex items-center justify-around gap-2">
                        <StarTest errorMm={controls.topIn ? focusError : 40} obstructed={style !== "refractor"} />
                        <div className="text-center">
                          <Knob
                            label="Focus"
                            value={controls.focusMm}
                            min={0}
                            max={FOCUS_TRAVEL_MM}
                            step={0.2}
                            sensitivity={0.08}
                            turns={6}
                            onChange={(v) => set({ focusMm: v })}
                            format={(v) => `${v.toFixed(1)} mm`}
                            tone={sharp ? "good" : "default"}
                          />
                          <p className={`mt-1 text-xs font-medium ${sharp ? "text-[#4ade80]" : "text-white/80"}`}>
                            {!controls.topIn ? "Put the eyepiece back first" : sharp ? "Sharp" : "Turn until the star is a point"}
                          </p>
                        </div>
                      </div>
                    )}

                    {panel === "align" && eq && balance && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs">
                          Your latitude
                          <input
                            type="number"
                            value={siteLat}
                            min={-90}
                            max={90}
                            onChange={(e) => Number.isFinite(Number(e.target.value)) && setSiteLat(Math.min(90, Math.max(-90, Number(e.target.value))))}
                            className="w-20 rounded-md border border-white/30 bg-black/40 px-2 py-1 text-xs"
                          />
                          °
                        </label>
                        <div className="flex justify-around">
                          <Knob label="Latitude" value={controls.latitudeDeg} min={0} max={90} step={0.1} sensitivity={0.05} onChange={(v) => set({ latitudeDeg: v })} format={(v) => `${v.toFixed(1)}°`} size={56} tone={Math.abs(controls.latitudeDeg - poleAlt) < 0.4 ? "good" : "default"} />
                          <Knob label="Azimuth" value={controls.polarAzimuthDeg} min={-20} max={20} step={0.1} sensitivity={0.04} onChange={(v) => set({ polarAzimuthDeg: v })} format={(v) => `${v.toFixed(1)}°`} size={56} tone={Math.abs(controls.polarAzimuthDeg) < 0.4 ? "good" : "default"} />
                          <Knob label="Weight" value={controls.counterweight} min={0} max={1} step={0.01} sensitivity={0.004} onChange={(v) => set({ counterweight: v })} format={(v) => `${Math.round(v * 100)}%`} size={56} tone={balance.state === "balanced" ? "good" : "warn"} />
                        </div>
                        <p className={`text-xs ${polarError <= POLAR_OK_DEG ? "text-[#4ade80]" : "text-white/85"}`}>
                          {polarError <= POLAR_OK_DEG
                            ? "Polar aligned."
                            : `Polar axis ${polarError.toFixed(1)}° off the pole: stars drift up to ${polarDriftArcsecPerMin(polarError).toFixed(0)}″ a minute.`}
                        </p>
                        <BalanceBar ratio={balance.ratio} />
                        <p className={`text-xs ${balance.state === "balanced" ? "text-[#4ade80]" : "text-white/85"}`}>
                          {balance.state === "balanced" ? "Balanced." : balance.state === "tube-heavy" ? "Tube-heavy: slide the weight out." : "Weight-heavy: slide the weight in."}
                        </p>
                      </div>
                    )}

                    {panel === "align" && !eq && (
                      <div className="flex justify-around">
                        <Knob label="Altitude" value={controls.altitudeDeg} min={5} max={90} onChange={(v) => set({ altitudeDeg: v })} format={(v) => `${v}°`} size={56} />
                        <Knob label="Azimuth" value={controls.azimuthDeg} min={-180} max={180} onChange={(v) => set({ azimuthDeg: v })} format={(v) => `${v}°`} turns={1} size={56} />
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setPlaced((p) => p && { ...p, yaw: p.yaw + Math.PI / 12 })} className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs">
                        ↺ Turn
                      </button>
                      <button type="button" onClick={() => setPlaced((p) => p && { ...p, yaw: p.yaw - Math.PI / 12 })} className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs">
                        Turn ↻
                      </button>
                      <button type="button" onClick={() => setPlaced(undefined)} className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs">
                        Move
                      </button>
                    </div>
                  </div>
                )}
              </ArOverlay>
            </XRDomOverlay>
          </XR>
        </Canvas>
      </div>
    </div>
  );
}

/** The current XR session (outside the canvas, from the store). */
function useXRSession(store: ReturnType<typeof createXRStore>) {
  const [session, setSession] = useState(store.getState().session);
  useEffect(() => store.subscribe((s) => setSession(s.session)), [store]);
  return session;
}

/** Renders its children only during an AR session. */
function InSession({ children }: { children: React.ReactNode }) {
  const session = useXR((s) => s.session);
  return session ? <>{children}</> : null;
}

/** The bottom panel over the camera view. Taps on it don't reach the 3D scene. */
function ArOverlay({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("beforexrselect", block);
    return () => el.removeEventListener("beforexrselect", block);
  }, []);
  return (
    <div
      ref={ref}
      className="absolute inset-x-2 bottom-2 max-h-[48vh] overflow-y-auto rounded-2xl border border-white/15 bg-black/70 p-3 text-white shadow-2xl backdrop-blur"
      style={{ touchAction: "auto" }}
    >
      {children}
    </div>
  );
}

/* --- Placement --------------------------------------------------------- */

const hitMatrix = new Matrix4();
const hitUp = new Vector3();
const hitPoint = new Vector3();
const eyePoint = new Vector3();

/** A ring on the floor where the telescope would stand. */
function Reticle({ target, onFloorChange }: { target: React.RefObject<Vector3>; onFloorChange: (found: boolean) => void }) {
  const ring = useRef<Mesh>(null);
  const found = useRef(false);
  const camera = useThree((s) => s.camera);
  useXRHitTest((results, getWorldMatrix) => {
    // Floors, not walls: the surface faces up (a hit's Y axis is its normal),
    // or failing that, the hit is well below the phone.
    let hit = false;
    if (results[0] !== undefined && getWorldMatrix(hitMatrix, results[0])) {
      const facesUp = hitUp.setFromMatrixColumn(hitMatrix, 1).normalize().y > 0.9;
      const point = hitPoint.setFromMatrixPosition(hitMatrix);
      const below = camera.getWorldPosition(eyePoint).y - point.y > 0.5;
      hit = facesUp || below;
    }
    if (hit) {
      target.current.setFromMatrixPosition(hitMatrix);
      if (ring.current) {
        ring.current.position.copy(target.current);
        ring.current.visible = true;
      }
    }
    if (Boolean(hit) !== found.current) {
      found.current = Boolean(hit);
      onFloorChange(found.current);
    }
  }, "viewer");
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.18, 0.22, 48]} />
      <meshBasicMaterial color="#8b96ff" transparent opacity={0.85} />
    </mesh>
  );
}

/** Bridges the overlay's Place buttons (DOM) and the scene (camera position). */
let requestPlace: ((where?: "floor" | "front") => void) | undefined;

function PlaceAction({
  placed,
  reticle,
  onPlace,
}: {
  placed: boolean;
  reticle: React.RefObject<Vector3>;
  onPlace: (p: { position: [number, number, number]; yaw: number }) => void;
}) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (placed) return;
    requestPlace = (where = "floor") => {
      const eye = new Vector3();
      camera.getWorldPosition(eye);
      let p = reticle.current;
      if (where === "front") {
        // 1.5 m ahead along the level view direction, on the session's floor (y = 0 in local-floor space).
        const ahead = new Vector3();
        camera.getWorldDirection(ahead);
        ahead.y = 0;
        if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
        ahead.normalize().multiplyScalar(1.5);
        p = new Vector3(eye.x + ahead.x, 0, eye.z + ahead.z);
      }
      onPlace({ position: [p.x, p.y, p.z], yaw: facingYaw(p.x, p.z, eye.x, eye.z) });
    };
    return () => {
      requestPlace = undefined;
    };
  }, [placed, reticle, camera, onPlace]);
  return null;
}

function PlaceButton({ enabled }: { enabled: boolean }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => requestPlace?.("floor")}
      className="w-full rounded-lg bg-[#5162ff] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
    >
      Place here
    </button>
  );
}

/* --- The placed telescope ---------------------------------------------- */

function PlacedRig({
  item,
  parts,
  placed,
  onPress,
  onSelect,
  selected,
  poleGuide,
}: {
  item: ReturnType<typeof rigItem>;
  parts: Map<PartId, Group>;
  placed: { position: [number, number, number]; yaw: number };
  onPress: (id: PartId) => void;
  onSelect: (id: PartId) => void;
  selected?: PartId;
  poleGuide?: { siteLatitudeDeg: number };
}) {
  const register = useCallback(
    (id: PartId, obj: Group | null) => {
      if (obj) parts.set(id, obj);
      else parts.delete(id);
    },
    [parts],
  );
  const context = useMemo(() => ({ register, onSelect, onPress }), [register, onSelect, onPress]);
  useDevPartCentres(parts);
  return (
    <group position={placed.position} rotation={[0, placed.yaw, 0]}>
      <group scale={METRES_PER_UNIT}>
        <Grounded>
          <PartContext.Provider value={context}>
            <StageModel item={item} poleGuide={poleGuide} />
          </PartContext.Provider>
        </Grounded>
      </group>
      {selected && <SelectionBox part={selected} parts={parts} />}
    </group>
  );
}

/** Stands the model on the floor (a tube without a mount lies on its side). Measured once. */
function Grounded({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  const done = useRef(false);
  useFrame(() => {
    const g = ref.current;
    if (!g || done.current) return;
    done.current = true;
    g.parent?.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g);
    if (box.isEmpty()) return;
    // Box is in world metres; the group is in model units under a 0.1 scale.
    const inverse = new Matrix4().copy(g.parent!.matrixWorld).invert();
    const min = box.min.clone().applyMatrix4(inverse);
    g.position.y -= min.y;
  });
  return <group ref={ref}>{children}</group>;
}

/** An outline box around the selected part, following it as it moves. */
function SelectionBox({ part, parts }: { part: PartId; parts: Map<PartId, Group> }) {
  const helper = useMemo(() => new Box3Helper(new Box3(), new Color("#8b96ff")), []);
  const box = useMemo(() => new Box3(), []);
  useEffect(() => () => helper.dispose(), [helper]);
  useFrame(() => {
    const obj = parts.get(part);
    if (!obj || !helper.parent) {
      helper.visible = false;
      return;
    }
    box.setFromObject(obj);
    if (box.isEmpty()) {
      helper.visible = false;
      return;
    }
    // The helper lives under the placed group; express the box in its frame.
    const inverse = new Matrix4().copy(helper.parent.matrixWorld).invert();
    helper.box.copy(box).applyMatrix4(inverse).expandByScalar(0.01);
    helper.visible = true;
  });
  return <primitive object={helper} />;
}

/* --- Part name tags ----------------------------------------------------- */

/** Where the crosshair sits, as a fraction of screen height (above the bottom panel). */
const CROSSHAIR_Y = 0.36;

/** The ids of the parts currently on the rig (the parts map changes outside React). */
function useLabelledParts(parts: Map<PartId, Group>, active: boolean): PartId[] {
  const [ids, setIds] = useState<PartId[]>([]);
  useEffect(() => {
    const tick = () =>
      setIds((prev) => {
        const next = active ? [...parts.keys()].sort() : [];
        return next.join() === prev.join() ? prev : next;
      });
    tick();
    if (!active) return;
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [parts, active]);
  return ids;
}

/**
 * Projects each part to the screen every frame and moves its DOM tag there,
 * hiding tags that would overlap; reports the part under the crosshair.
 */
function PartLabels({
  parts,
  tags,
  show,
  selected,
  onLook,
}: {
  parts: Map<PartId, Group>;
  tags: Map<PartId, HTMLElement>;
  show: boolean;
  selected?: PartId;
  onLook: (id: PartId | undefined) => void;
}) {
  const camera = useThree((s) => s.camera);
  const box = useMemo(() => new Box3(), []);
  const v = useMemo(() => new Vector3(), []);
  const looking = useRef<PartId>(undefined);
  useEffect(() => () => onLook(undefined), [onLook]);
  useFrame(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h * CROSSHAIR_Y;
    const boxes: LabelBox<PartId>[] = [];
    for (const [id, obj] of parts) {
      box.setFromObject(obj);
      if (box.isEmpty()) continue;
      box.getCenter(v).project(camera);
      // Behind the camera or well off screen.
      if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const el = tags.get(id);
      boxes.push({ id, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, w: el?.offsetWidth || 80, h: el?.offsetHeight || 24 });
    }
    const look = partAtCentre(boxes, cx, cy, Math.max(56, Math.min(w, h) * 0.14));
    if (look !== looking.current) {
      looking.current = look;
      onLook(look);
    }
    const first = [look, selected].filter((id): id is PartId => Boolean(id));
    const shown = show ? visibleLabels(boxes, cx, cy, first) : new Set<PartId>();
    const at = new Map(boxes.map((b) => [b.id, b]));
    for (const [id, el] of tags) {
      const b = at.get(id);
      if (b && shown.has(id)) {
        el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px) translate(-50%, -100%)`;
        el.style.visibility = "visible";
      } else {
        el.style.visibility = "hidden";
      }
    }
  });
  return null;
}

/** The tags, crosshair and "looking at" chip over the camera view. Tapping a tag or the chip selects that part. */
function LabelLayer({
  ids,
  tags,
  name,
  looking,
  selected,
  onPick,
}: {
  ids: PartId[];
  tags: Map<PartId, HTMLElement>;
  name: (id: PartId) => string;
  looking?: PartId;
  selected?: PartId;
  onPick: (id: PartId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Taps on tags and the chip are for the page, not the 3D scene.
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("beforexrselect", block);
    return () => el.removeEventListener("beforexrselect", block);
  }, []);
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden text-white">
      <div
        aria-hidden
        className={`absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_6px_rgba(0,0,0,0.6)] transition-colors ${looking ? "border-[#8b96ff]" : "border-white/70"}`}
        style={{ left: "50%", top: `${CROSSHAIR_Y * 100}%` }}
      >
        <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      </div>

      <div className="absolute inset-x-0 top-3 flex justify-center px-3">
        {looking ? (
          <button
            type="button"
            onClick={() => onPick(looking)}
            className="pointer-events-auto rounded-full border border-[#8b96ff] bg-black/70 px-4 py-2 text-sm shadow-lg backdrop-blur"
          >
            <span className="text-white/70">Looking at </span>
            <span className="font-semibold">{name(looking)}</span>
            <span className="text-[#aab3ff]">{selected === looking ? " · details below" : " · tap for details"}</span>
          </button>
        ) : (
          <p className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80">Aim the circle at a part to name it</p>
        )}
      </div>

      {ids.map((id) => (
        <button
          key={id}
          type="button"
          ref={(el) => {
            if (el) tags.set(id, el);
            else tags.delete(id);
          }}
          onClick={() => onPick(id)}
          style={{ visibility: "hidden" }}
          className="pointer-events-auto absolute top-0 left-0 flex flex-col items-center"
        >
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow ${
              id === selected ? "bg-[#5162ff] text-white" : id === looking ? "bg-white text-black" : "bg-black/65 text-white"
            }`}
          >
            {name(id)}
          </span>
          <span className="h-2.5 w-px bg-white/80" />
          <span className="size-1.5 rounded-full bg-white" />
        </button>
      ))}
    </div>
  );
}

/* --- Development-only hooks for automated tests (emulator) -------------- */

type DevWindow = Window & { __arEvents?: string[]; __arParts?: Record<string, [number, number, number]> };

/** Records part presses and taps so tests can check the 3D interaction path. */
function devRecord(kind: "press" | "select", id: PartId) {
  if (process.env.NODE_ENV !== "development") return;
  const w = window as DevWindow;
  (w.__arEvents ??= []).push(`${kind}:${id}`);
}

/** Publishes each part's world-space centre, so tests can aim at real parts. */
function useDevPartCentres(parts: Map<PartId, Group>) {
  const box = useMemo(() => new Box3(), []);
  const centre = useMemo(() => new Vector3(), []);
  const last = useRef(0);
  useFrame(() => {
    if (process.env.NODE_ENV !== "development") return;
    const now = performance.now();
    if (now - last.current < 500) return;
    last.current = now;
    const out: Record<string, [number, number, number]> = {};
    for (const [id, obj] of parts) {
      box.setFromObject(obj);
      if (box.isEmpty()) continue;
      box.getCenter(centre);
      out[id] = [centre.x, centre.y, centre.z];
    }
    (window as DevWindow).__arParts = out;
  });
}
