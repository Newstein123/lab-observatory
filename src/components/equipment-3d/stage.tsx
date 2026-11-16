"use client";

import { Bounds, Center, ContactShadows, Environment, Html, Lightformer, OrbitControls, useBounds } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Vector3, type Group } from "three";
import { BarlowModel, CameraModel, FilterModel } from "./accessory-models";
import { eyepieceDimensions } from "./dimensions";
import { EyepieceModel } from "./eyepiece-model";
import { mm } from "./materials";
import { MountModel } from "./mount-model";
import { OpticalTrain } from "./optical-train";
import { PartContext, type PartId } from "./parts";
import { otaDimensions } from "./dimensions";
import { TelescopeOTA } from "./telescope-model";
import { stageItemKey, type StageItem } from "./types";

export interface StageProps {
  item: StageItem;
  /** Show rotate / reset buttons. */
  controls?: boolean;
  /** Start slowly rotating (stops when the user interacts). */
  autoRotate?: boolean;
  label: string;
  className?: string;
  /** Make parts clickable (learning mode). */
  onSelectPart?: (id: PartId) => void;
  /** Label this part in the scene. */
  selectedPart?: PartId;
  selectedLabel?: string;
  /** Show north and the celestial pole (equatorial alignment). */
  poleGuide?: { siteLatitudeDeg: number };
}

/** Approximate footprint radius in scene units, for the turntable and zoom limits. */
function footprint(item: StageItem): number {
  switch (item.kind) {
    case "eyepiece":
      return mm(eyepieceDimensions(item.spec).bodyR * 2.2);
    case "camera":
      return mm(90);
    case "barlow":
      return mm(45);
    case "filter":
      return mm(32);
    case "mount":
      return mm(item.optics ? Math.max(650, otaDimensions(item.optics).length * 0.55) : 650);
    case "rig":
    case "telescope":
      return item.mount
        ? mm(Math.max(650, otaDimensions(item.optics).length * 0.55))
        : mm(otaDimensions(item.optics).length * 0.55);
  }
}

function Model({ item, poleGuide }: { item: StageItem; poleGuide?: StageProps["poleGuide"] }) {
  switch (item.kind) {
    case "rig": {
      const ota = { focusMm: item.focusMm, trainMode: item.train.mode, train: <OpticalTrain train={item.train} /> };
      if (item.mount) return <MountModel spec={item.mount} optics={item.optics} pose={item.pose} ota={ota} poleGuide={poleGuide} />;
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <TelescopeOTA optics={item.optics} {...ota} />
        </group>
      );
    }
    case "eyepiece":
      return <EyepieceModel spec={item.spec} />;
    case "camera":
      return <CameraModel spec={item.spec} />;
    case "barlow":
      return <BarlowModel spec={item.spec} />;
    case "filter":
      return <FilterModel spec={item.spec} />;
    case "mount":
      return <MountModel spec={item.spec} optics={item.optics} />;
    case "telescope":
      if (item.mount) return <MountModel spec={item.mount} optics={item.optics} />;
      // Tube alone, lying on its side.
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <TelescopeOTA optics={item.optics} />
        </group>
      );
  }
}

/**
 * Spins the model until the user takes over. The canvas renders on demand,
 * so this asks for a frame only while something is moving: while spinning,
 * and briefly after the model or angle changes so the camera fit can settle.
 */
function Turntable({ children, spinning, yaw, settleKey }: { children: React.ReactNode; spinning: boolean; yaw: number; settleKey: string }) {
  const ref = useRef<Group>(null);
  const extra = useRef(0);
  const settleUntil = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    settleUntil.current = performance.now() + 1200;
    invalidate();
  }, [settleKey, yaw, invalidate]);
  useFrame((_, dt) => {
    if (spinning) extra.current += Math.min(dt, 0.1) * 0.35;
    if (ref.current) ref.current.rotation.y = yaw + extra.current;
    if (spinning || performance.now() < settleUntil.current) invalidate();
  });
  return <group ref={ref}>{children}</group>;
}

/** True while the element is on screen and the tab is visible. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let intersecting = true;
    const update = () => setOnScreen(intersecting && document.visibilityState === "visible");
    const io = new IntersectionObserver(([e]) => {
      intersecting = e.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return onScreen;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Moves the camera to a part (or back to the whole setup) when asked. */
function FocusOnPart({ part, trainKey, parts }: { part?: PartId; trainKey: string; parts: Map<PartId, Group> }) {
  const api = useBounds();
  const camera = useThree((st) => st.camera);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!part) return;
    }
    // Let a swapped part finish sliding in before framing it.
    const id = window.setTimeout(() => {
      const obj = part ? parts.get(part) : undefined;
      const view = obj ? partViewpoint(obj, camera.position) : undefined;
      if (obj && view) api.refresh(obj).clip().to(view);
      else api.refresh().clip().fit();
    }, 750);
    return () => window.clearTimeout(id);
  }, [part, trainKey, api, parts, camera]);
  return null;
}

/**
 * A camera position that sees a part rather than the tube in front of it:
 * beside the part, a little along the direction it sticks out (its local +Y,
 * the optical axis of the train) and a little above.
 */
function partViewpoint(obj: Group, from: Vector3): { position: [number, number, number]; target: [number, number, number] } | undefined {
  obj.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(obj);
  if (box.isEmpty()) return undefined;
  const c = box.getCenter(new Vector3());
  const radius = box.getSize(new Vector3()).length() / 2;
  const axis = new Vector3(0, 1, 0).transformDirection(obj.matrixWorld);
  const up = new Vector3(0, 1, 0);
  const side = new Vector3().crossVectors(axis, up);
  if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  side.normalize();
  // Stay on the side the viewer is already on, so the camera doesn't swing round.
  if (side.dot(from.clone().sub(c)) < 0) side.negate();
  const dir = side.add(axis.multiplyScalar(0.6)).add(up.multiplyScalar(0.35)).normalize();
  const dist = Math.max(0.4, radius * 3.4);
  const p = c.clone().add(dir.multiplyScalar(dist));
  return { position: [p.x, p.y, p.z], target: [c.x, c.y, c.z] };
}

/** A floating name tag on the selected part. */
function PartLabel({ part, text, parts, version }: { part: PartId; text: string; parts: Map<PartId, Group>; version: string }) {
  const [pos, setPos] = useState<[number, number, number]>();
  useEffect(() => {
    const id = window.setTimeout(() => {
      const obj = parts.get(part);
      if (!obj) return setPos(undefined);
      const box = new Box3().setFromObject(obj);
      if (box.isEmpty()) return setPos(undefined);
      const c = box.getCenter(new Vector3());
      setPos([c.x, box.max.y + 0.08, c.z]);
    }, 50);
    return () => window.clearTimeout(id);
  }, [part, parts, version]);
  if (!pos) return null;
  return (
    <Html position={pos} center style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
      <span className="whitespace-nowrap rounded-md border border-accent/60 bg-black/80 px-2 py-1 text-xs font-medium text-foreground shadow-lg">
        {text}
      </span>
    </Html>
  );
}

export default function EquipmentStage({
  item,
  controls = true,
  autoRotate = true,
  label,
  className = "",
  onSelectPart,
  selectedPart,
  selectedLabel,
  poleGuide,
}: StageProps) {
  const [spinning, setSpinning] = useState(false);
  // Equatorial setups start viewed from the south-east, so the mount head and
  // counterweight are not hidden behind the tube.
  const [yaw, setYaw] = useState(item.kind === "rig" && item.mount?.type === "equatorial" ? -1.5 : 0.5);
  const radius = footprint(item);
  const key = stageItemKey(item);

  const focusPart = item.kind === "rig" ? item.focusPart : undefined;
  useEffect(() => {
    setSpinning(autoRotate && !focusPart && !prefersReducedMotion());
  }, [autoRotate, key, focusPart]);

  // Parts register themselves so the camera can frame them and labels can find them.
  const parts = useMemo(() => new Map<PartId, Group>(), []);
  const register = useCallback(
    (id: PartId, obj: Group | null) => {
      if (obj) parts.set(id, obj);
      else parts.delete(id);
    },
    [parts],
  );
  const partContext = useMemo(() => ({ register, onSelect: onSelectPart }), [register, onSelectPart]);
  // Changes that should keep frames coming briefly (animations, camera moves).
  const settleKey = JSON.stringify(item) + (selectedPart ?? "");
  const trainKey = item.kind === "rig" ? JSON.stringify(item.train) : "";

  const box = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(box);

  return (
    <div ref={box} role="img" aria-label={label} className={`relative ${className}`}>
      <Canvas
        // Render only when something changes, and not at all off screen.
        frameloop={onScreen ? "demand" : "never"}
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [3, 2, 4], fov: 30, near: 0.01, far: 500 }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 7, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-5, 2, -4]} intensity={0.9} color="#8f9bff" />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
          <Lightformer form="rect" intensity={1.6} position={[-6, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[3, 10, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#8b96ff" position={[6, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[2, 10, 1]} />
          <Lightformer form="ring" intensity={0.8} color="#c8b8ff" position={[0, 2, -6]} scale={3} />
        </Environment>

        <PartContext.Provider value={partContext}>
          <Bounds key={key} fit clip observe margin={1.3}>
            <Turntable spinning={spinning && onScreen} yaw={yaw} settleKey={settleKey}>
              {item.kind === "rig" && item.mount ? (
                // Stands on the ground at the origin already; re-centring would shift it as it moves.
                <Model item={item} poleGuide={poleGuide} />
              ) : (
                <Center top>
                  <Model item={item} />
                </Center>
              )}
              {selectedPart && selectedLabel && <PartLabel part={selectedPart} text={selectedLabel} parts={parts} version={settleKey} />}
            </Turntable>
            {item.kind === "rig" && <FocusOnPart part={focusPart} trainKey={trainKey} parts={parts} />}
          </Bounds>
        </PartContext.Provider>

        {/* Turntable platform with a faint guide ring */}
        <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[radius * 1.25, 96]} />
          <meshStandardMaterial color="#0b1024" metalness={0.4} roughness={0.6} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.24, radius * 1.27, 128]} />
          <meshBasicMaterial color="#6c7bff" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={radius * 3} blur={2.4} far={radius * 2} resolution={256} />

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={radius * 0.9}
          maxDistance={radius * 9}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.04}
          onStart={() => setSpinning(false)}
        />
      </Canvas>

      {controls && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/70 p-1 backdrop-blur">
          <StageButton label="Rotate left" onClick={() => (setSpinning(false), setYaw((y) => y - Math.PI / 6))}>
            <path d="M15 6l-6 6 6 6" />
          </StageButton>
          <StageButton
            label={spinning ? "Stop rotating" : "Rotate continuously"}
            onClick={() => setSpinning((s) => !s)}
            pressed={spinning}
          >
            <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
          </StageButton>
          <StageButton label="Rotate right" onClick={() => (setSpinning(false), setYaw((y) => y + Math.PI / 6))}>
            <path d="M9 6l6 6-6 6" />
          </StageButton>
          <span className="px-2 font-mono text-[11px] text-muted">360°</span>
        </div>
      )}
    </div>
  );
}

function StageButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-full transition-colors ${
        pressed ? "bg-accent/25 text-foreground" : "text-muted hover:bg-surface-raised hover:text-foreground"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/** The model as drawn on the stage, for reuse (e.g. exporting it for AR). */
export { Model as StageModel };
