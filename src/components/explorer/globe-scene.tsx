"use client";

/**
 * Interactive lunar globe: LROC WAC mosaic on a sphere whose relief comes
 * from LOLA elevation (optionally exaggerated), lit by the Sun as it is at
 * the observation time. A scientific reconstruction, not the eyepiece image.
 * Loaded lazily (three.js) by model-tab.tsx.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, type Mesh } from "three";
import { LUNAR_ASSETS } from "@/modules/explorer/lunar/assets";
import type { SurfaceFeature } from "@/modules/explorer/types";
import type { MoonOrientation } from "@/modules/sky/moon";

const D2R = Math.PI / 180;
const MOON_RADIUS_M = 1_737_400;

/** Unit vector for a selenographic point, matching three's SphereGeometry UVs (left edge of the map = longitude −180°). */
export function lunarVector(latDeg: number, lonDeg: number, r = 1): Vector3 {
  const phi = (lonDeg + 180) * D2R;
  const c = Math.cos(latDeg * D2R);
  return new Vector3(-Math.cos(phi) * c * r, Math.sin(latDeg * D2R) * r, Math.sin(phi) * c * r);
}

interface Elevation {
  data: Int16Array;
  width: number;
  height: number;
}

let elevationPromise: Promise<Elevation> | undefined;
function loadElevation(): Promise<Elevation> {
  const a = LUNAR_ASSETS["elevation-global"];
  elevationPromise ??= fetch(a.src)
    .then((r) => r.arrayBuffer())
    .then((b) => ({ data: new Int16Array(b), width: a.widthPx!, height: a.heightPx! }));
  return elevationPromise;
}

function useElevation() {
  const [e, setE] = useState<Elevation>();
  useEffect(() => {
    loadElevation().then(setE, () => {});
  }, []);
  return e;
}

/** A sphere displaced by LOLA elevation × exaggeration, normals recomputed so relief is shaded. */
function useReliefGeometry(elev: Elevation | undefined, exaggeration: number) {
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 360, 180);
    if (!elev) return g;
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      const v = 1 - uv.getY(i);
      const x = Math.min(elev.width - 1, Math.max(0, Math.floor(u * elev.width)));
      const y = Math.min(elev.height - 1, Math.max(0, Math.floor(v * elev.height)));
      const k = 1 + (elev.data[y * elev.width + x] / MOON_RADIUS_M) * exaggeration;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }, [elev, exaggeration]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

export interface GlobeSceneProps {
  features: readonly SurfaceFeature[];
  selectedId?: string;
  orientation?: MoonOrientation;
  exaggeration: number;
  tonightLight: boolean;
  showLabels: boolean;
  onSelect: (id: string) => void;
}

function Globe({ features, selectedId, orientation, exaggeration, tonightLight, showLabels, onSelect }: GlobeSceneProps) {
  const texture = useLoader(TextureLoader, LUNAR_ASSETS["albedo-4k"].src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const elev = useElevation();
  const geometry = useReliefGeometry(elev, exaggeration);
  const globe = useRef<Mesh>(null);
  const focus = features.find((f) => f.id === selectedId);
  // Turn the globe so the selected feature (else the Earth-facing point) faces the camera.
  const [lat, lon] = focus ? [focus.latDeg, focus.lonDeg] : orientation ? [orientation.librationLatDeg, orientation.librationLonDeg] : [0, 0];
  const d = lunarVector(lat, lon);
  const yaw = Math.atan2(-d.x, d.z);
  const sun = orientation ? lunarVector(orientation.subSolarLatDeg, orientation.subSolarLonDeg, 6) : new Vector3(0, 0, 6);

  return (
    <group rotation={[lat * D2R, 0, 0]}>
      <group rotation={[0, yaw, 0]}>
        <mesh ref={globe} geometry={geometry}>
          <meshStandardMaterial map={texture} roughness={1} metalness={0} />
        </mesh>
        {tonightLight ? <directionalLight position={sun} intensity={2.6} /> : null}
        {features.map((f) => {
          const p = lunarVector(f.latDeg, f.lonDeg, 1.004);
          const sel = f.id === selectedId;
          const r = Math.max(0.006, Math.min(0.05, (f.diameterKm / 1737.4) * 0.5));
          return (
            <group key={f.id} position={p}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(f.id);
                }}
                onPointerOver={() => (document.body.style.cursor = "pointer")}
                onPointerOut={() => (document.body.style.cursor = "")}
              >
                <sphereGeometry args={[sel ? Math.max(r * 0.35, 0.012) : 0.007, 12, 12]} />
                <meshBasicMaterial color={sel ? "#a5b4fc" : "#ffffff"} transparent opacity={sel ? 1 : 0.75} />
              </mesh>
              {(sel || (showLabels && f.priority === 1)) && (
                // Hidden when the globe is in the way (raycast against the globe mesh).
                <Html center distanceFactor={1.2} zIndexRange={[20, 0]} occlude={[globe as React.RefObject<Mesh>]} style={{ pointerEvents: "none" }}>
                  <Label sel={sel} name={f.name} />
                </Html>
              )}
            </group>
          );
        })}
      </group>
    </group>
  );
}

function Label({ name, sel }: { name: string; sel: boolean }) {
  return (
    <span
      className={`-translate-y-4 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${sel ? "border-accent bg-accent/40 text-white" : "border-white/20 bg-black/60 text-white/85"}`}
    >
      {name}
    </span>
  );
}

export default function GlobeScene(props: GlobeSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 3.1], fov: 35 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={["#04050b"]} />
      <ambientLight intensity={props.tonightLight ? 0.08 : 1.1} />
      {!props.tonightLight && <directionalLight position={[2, 1.5, 4]} intensity={0.9} />}
      <Globe {...props} />
      <OrbitControls enablePan={false} minDistance={1.35} maxDistance={6} rotateSpeed={0.5} zoomSpeed={0.7} />
    </Canvas>
  );
}
