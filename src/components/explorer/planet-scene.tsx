"use client";

/**
 * 3D views of Jupiter and Saturn (loaded lazily by planet-model-tab.tsx):
 *  - "planet": the globe turned as it is seen now (central meridian, tilt
 *    towards Earth, axis angle), Jupiter with the Cassini map, Saturn with
 *    rings built from their measured radii.
 *  - "orbits": the moons at their computed positions with their orbits,
 *    seen from Earth (as in the eyepiece, north up) or from above.
 * Scientific reconstructions, not the telescope's image.
 */
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, SRGBColorSpace, TextureLoader, Vector3, type Mesh } from "three";
import jupiterAssets from "@/modules/explorer/jupiter/assets.json";
import type { RingFeature } from "@/modules/explorer/types";
import type { Satellite } from "@/modules/targets/satellites";

const D2R = Math.PI / 180;

export interface PlanetPose {
  /** Sub-Earth latitude (Jupiter: planetocentric De; Saturn: ring tilt B), degrees. */
  tiltDeg: number;
  /** Position angle of the north pole, degrees. */
  poleDeg: number;
}

export interface JupiterPose extends PlanetPose {
  cm2Deg: number;
  grsLonDeg: number;
}

export interface OrbitMoon {
  id: string;
  name: string;
  /** Sky-frame offsets (x west, y north, z towards Earth) in planet equatorial radii, at the shown time. */
  now: { x: number; y: number; z: number };
  /** The orbit traced over one period, same frame and units. */
  path: [number, number, number][];
}

export interface PlanetSceneProps {
  planet: "jupiter" | "saturn";
  mode: "planet" | "orbits";
  pose: PlanetPose | JupiterPose;
  rings: readonly RingFeature[];
  /** Saturn's equatorial radius, km (rings are scaled to it). */
  globeKm: number;
  flattening: number;
  moons: readonly OrbitMoon[];
  selectedId?: string;
  view: "earth" | "above";
  onSelectRing?: (id: string) => void;
  onSelectMoon?: (id: string) => void;
  showLabels: boolean;
  /** Features to mark on the globe (Jupiter). */
  markers?: readonly GlobeMarker[];
}

/** Ring shading by type: from their typical optical depths (illustrative). */
const RING_LOOK: Record<string, { color: string; opacity: number }> = {
  "c-ring": { color: "#8f8573", opacity: 0.28 },
  "b-ring": { color: "#e8dcc0", opacity: 0.95 },
  "cassini-division": { color: "#5d574c", opacity: 0.12 },
  "a-ring": { color: "#cfc3a8", opacity: 0.7 },
  "encke-gap": { color: "#000000", opacity: 0 },
  "f-ring": { color: "#bdb4a2", opacity: 0.35 },
};

function Rings({ rings, globeKm, selectedId, onSelect }: { rings: readonly RingFeature[]; globeKm: number; selectedId?: string; onSelect?: (id: string) => void }) {
  // The A ring is drawn in two parts around the Encke Gap.
  const encke = rings.find((r) => r.id === "encke-gap");
  const parts = rings.flatMap((r) =>
    r.id === "a-ring" && encke
      ? [
          { ring: r, inner: r.innerKm, outer: encke.innerKm },
          { ring: r, inner: encke.outerKm, outer: r.outerKm },
        ]
      : [{ ring: r, inner: r.innerKm, outer: r.outerKm }],
  );
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {parts.map(({ ring, inner, outer }, i) => {
        const look = RING_LOOK[ring.id] ?? { color: "#cccccc", opacity: 0.5 };
        const sel = ring.id === selectedId;
        return (
          <mesh
            key={`${ring.id}-${i}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(ring.id);
            }}
          >
            <ringGeometry args={[inner / globeKm, outer / globeKm, 256, 1]} />
            <meshBasicMaterial
              color={sel ? "#a5b4fc" : look.color}
              transparent
              opacity={sel ? Math.max(0.55, look.opacity) : ring.id === "encke-gap" ? 0.001 : look.opacity}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** A Jovian feature's position on the unit globe (before the spin), from the map's u and planetographic latitude. */
function jovianPoint(u: number, latDeg: number, flattening: number, lift = 1.01): [number, number, number] {
  const beta = Math.atan((1 - flattening) * Math.tan(latDeg * D2R));
  const phi = 2 * Math.PI * u;
  return [-Math.cos(phi) * Math.cos(beta) * lift, Math.sin(beta) * lift, Math.sin(phi) * Math.cos(beta) * lift];
}

export interface GlobeMarker {
  id: string;
  name: string;
  latDeg: number;
  /** System II west longitude. */
  lonDeg: number;
}

function JupiterGlobe({ pose, flattening, markers, selectedId, showLabels }: { pose: JupiterPose; flattening: number; markers: readonly GlobeMarker[]; selectedId?: string; showLabels: boolean }) {
  const texture = useLoader(TextureLoader, jupiterAssets.map.src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  // Texture u at the central meridian: the map was aligned on the Great Red Spot (west longitude grows to the left).
  const uCm = jupiterAssets.map.grsU - (pose.cm2Deg - pose.grsLonDeg) / 360;
  const spin = Math.PI / 2 - 2 * Math.PI * uCm;
  const uOf = (lonDeg: number) => jupiterAssets.map.grsU - (lonDeg - pose.grsLonDeg) / 360;
  const globe = useRef<Mesh>(null);
  return (
    <group rotation={[0, spin, 0]}>
      <mesh ref={globe} scale={[1, 1 - flattening, 1]}>
        <sphereGeometry args={[1, 128, 64]} />
        <meshStandardMaterial map={texture} roughness={1} metalness={0} />
      </mesh>
      {markers.map((m) => {
        const p = jovianPoint(uOf(m.lonDeg), m.latDeg, flattening);
        const sel = m.id === selectedId;
        return (
          <group key={m.id} position={p}>
            <mesh>
              <sphereGeometry args={[sel ? 0.03 : 0.018, 12, 12]} />
              <meshBasicMaterial color={sel ? "#a5b4fc" : "#ffffff"} />
            </mesh>
            {(sel || showLabels) && (
              // Hidden when the globe is in the way.
              <Html center zIndexRange={[20, 0]} occlude={[globe as React.RefObject<Mesh>]} style={{ pointerEvents: "none" }}>
                <span className={`-translate-y-4 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] ${sel ? "border-accent bg-accent/40 text-white" : "border-white/20 bg-black/60 text-white/85"}`}>
                  {m.name}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function SaturnGlobe({ flattening }: { flattening: number }) {
  return (
    <mesh scale={[1, 1 - flattening, 1]}>
      <sphereGeometry args={[1, 96, 48]} />
      <meshStandardMaterial color="#d8c9a3" roughness={1} metalness={0} />
    </mesh>
  );
}

/** The planet as seen now: pole turned by the axis angle, tilted by the sub-Earth latitude. */
function Planet(props: PlanetSceneProps) {
  const { planet, pose, rings, globeKm, flattening, selectedId, onSelectRing } = props;
  return (
    <group rotation={[0, 0, pose.poleDeg * D2R]}>
      <group rotation={[pose.tiltDeg * D2R, 0, 0]}>
        {planet === "jupiter" ? (
          <JupiterGlobe pose={pose as JupiterPose} flattening={flattening} markers={props.markers ?? []} selectedId={selectedId} showLabels={props.showLabels && props.mode === "planet"} />
        ) : (
          <SaturnGlobe flattening={flattening} />
        )}
        {rings.length > 0 && <Rings rings={rings} globeKm={globeKm} selectedId={selectedId} onSelect={onSelectRing} />}
      </group>
    </group>
  );
}

function Orbits({ moons, selectedId, onSelectMoon, showLabels }: PlanetSceneProps) {
  return (
    <>
      {moons.map((m) => {
        const sel = m.id === selectedId;
        return (
          <group key={m.id}>
            <Line points={m.path} color={sel ? "#a5b4fc" : "#5b6390"} lineWidth={sel ? 2 : 1} transparent opacity={sel ? 1 : 0.7} />
            <mesh
              position={[m.now.x, m.now.y, m.now.z]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectMoon?.(m.id);
              }}
            >
              <sphereGeometry args={[sel ? 0.45 : 0.32, 16, 16]} />
              <meshBasicMaterial color={sel ? "#c7d2fe" : "#f1f1f1"} />
            </mesh>
            {(showLabels || sel) && (
              <Html position={[m.now.x, m.now.y, m.now.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <span className={`-translate-y-4 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] ${sel ? "border-accent bg-accent/40 text-white" : "border-white/20 bg-black/60 text-white/85"}`}>
                  {m.name}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

/** Points the camera from Earth (+z, north up) or along the orbits' axis, at a distance that fits them. */
function CameraRig({ view, moons, extent }: { view: "earth" | "above"; moons: readonly OrbitMoon[]; extent: number }) {
  const { camera } = useThree();
  const normal = useMemo(() => {
    // Orbit pole from the largest orbit's path.
    const m = [...moons].sort((a, b) => b.path.length - a.path.length)[0];
    if (!m || m.path.length < 3) return new Vector3(0, 1, 0);
    const a = new Vector3(...m.path[0]);
    const b = new Vector3(...m.path[Math.floor(m.path.length / 4)]);
    const n = a.clone().cross(b).normalize();
    return n.y < 0 ? n.negate() : n;
  }, [moons]);
  useEffect(() => {
    const d = extent * 2.6;
    if (view === "earth") {
      camera.position.set(0, 0, d);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.copy(normal.clone().multiplyScalar(d));
      camera.up.set(0, 0, -1);
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [view, normal, extent, camera]);
  return null;
}

export default function PlanetScene(props: PlanetSceneProps) {
  const orbits = props.mode === "orbits";
  const extent = orbits ? Math.max(4, ...props.moons.map((m) => Math.max(...m.path.map((p) => Math.hypot(...p))))) : props.rings.length ? 2.5 : 1.2;
  return (
    <Canvas camera={{ position: [0, 0, extent * 2.6], fov: 35, near: 0.05, far: extent * 20 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={["#04050b"]} />
      <ambientLight intensity={0.55} />
      {/* Sunlight from roughly behind the observer: planets beyond Earth are nearly full. */}
      <directionalLight position={[1.5, 1, 6]} intensity={1.6} />
      <Planet {...props} />
      {orbits && <Orbits {...props} />}
      {orbits && (
        <Html position={[0, -extent * 0.95, 0]} center style={{ pointerEvents: "none" }}>
          <span className="whitespace-nowrap text-[10px] text-white/50">{props.view === "earth" ? "As seen from Earth · north up · moons not to scale" : "From above the orbits · moons not to scale"}</span>
        </Html>
      )}
      <CameraRig view={orbits ? props.view : "earth"} moons={props.moons} extent={extent} />
      <OrbitControls enablePan={false} minDistance={extent * 0.4} maxDistance={extent * 6} rotateSpeed={0.5} />
    </Canvas>
  );
}

export type { Satellite };
