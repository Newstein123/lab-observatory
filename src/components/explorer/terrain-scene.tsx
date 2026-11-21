"use client";

/**
 * 3D terrain around a landmark from LOLA 118 m elevation, draped with the
 * LROC WAC 100 m mosaic or shown as plain relief. A scientific
 * reconstruction from orbital data, not a magnified eyepiece image.
 * Loaded lazily (three.js) by model-tab.tsx.
 */
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Float32BufferAttribute, PlaneGeometry, SRGBColorSpace, TextureLoader } from "three";
import { elevationAt, type CraterMetrics, type Terrain } from "@/modules/explorer/terrain";

export interface TerrainLayers {
  rim: boolean;
  peak: boolean;
  /** Drape the LROC image (shows the bright ejecta rays) instead of plain relief. */
  imagery: boolean;
  surroundings: boolean;
}

export interface TerrainSceneProps {
  terrain: Terrain;
  metrics?: CraterMetrics;
  diameterKm: number;
  exaggeration: number;
  layers: TerrainLayers;
}

function Surface({ terrain, diameterKm, exaggeration, layers }: TerrainSceneProps) {
  const texture = useLoader(TextureLoader, terrain.albedoSrc);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const { n, sideKm, elevation } = terrain;
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(sideKm, sideKm, n - 1, n - 1);
    g.rotateX(-Math.PI / 2); // north towards −z
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const dimFrom = 0.8 * diameterKm;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, (elevation[i] / 1000) * exaggeration);
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const k = layers.surroundings || r < dimFrom ? 1 : Math.max(0.12, 1 - (r - dimFrom) / (0.25 * diameterKm));
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k;
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [n, sideKm, elevation, exaggeration, diameterKm, layers.surroundings]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      {layers.imagery ? (
        <meshStandardMaterial map={texture} vertexColors roughness={1} metalness={0} />
      ) : (
        <meshStandardMaterial color="#b9b6ae" vertexColors roughness={1} metalness={0} />
      )}
    </mesh>
  );
}

/** The measured rim crest, following the terrain. */
function Rim({ terrain, metrics, exaggeration }: { terrain: Terrain; metrics: CraterMetrics; exaggeration: number }) {
  const points = useMemo(() => {
    const N = 180;
    // Rim crest radius on each azimuth: the highest point near the mean rim radius…
    const radii = Array.from({ length: N }, (_, k) => {
      const a = (k / N) * 2 * Math.PI;
      let best = { r: metrics.rimRadiusKm, e: -Infinity };
      for (let r = metrics.rimRadiusKm * 0.85; r <= metrics.rimRadiusKm * 1.15; r += terrain.kmPerSample / 2) {
        const e = elevationAt(terrain, r * Math.sin(a), r * Math.cos(a));
        if (e > best.e) best = { r, e };
      }
      return best.r;
    });
    // …smoothed with a circular median, so single hills outside the rim do not make spikes.
    const smooth = radii.map((_, k) => {
      const w = Array.from({ length: 11 }, (_, d) => radii[(k + d - 5 + N) % N]).sort((x, y) => x - y);
      return w[5];
    });
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= N; k++) {
      const a = ((k % N) / N) * 2 * Math.PI;
      const r = smooth[k % N];
      const e = elevationAt(terrain, r * Math.sin(a), r * Math.cos(a));
      pts.push([r * Math.sin(a), (e / 1000) * exaggeration + 0.15, -r * Math.cos(a)]);
    }
    return pts;
  }, [terrain, metrics, exaggeration]);
  return <Line points={points} color="#a5b4fc" lineWidth={2} />;
}

function Peak({ terrain, metrics, exaggeration }: { terrain: Terrain; metrics: CraterMetrics; exaggeration: number }) {
  // Highest sample within 0.15 D of the centre.
  const at = useMemo(() => {
    let best = { x: 0, y: 0, e: -Infinity };
    const lim = metrics.rimRadiusKm * 0.3;
    for (let y = -lim; y <= lim; y += terrain.kmPerSample)
      for (let x = -lim; x <= lim; x += terrain.kmPerSample) {
        const e = elevationAt(terrain, x, y);
        if (e > best.e) best = { x, y, e };
      }
    return best;
  }, [terrain, metrics]);
  if (metrics.centralPeakM === undefined) return null;
  return (
    <group position={[at.x, (at.e / 1000) * exaggeration, -at.y]}>
      <Html center distanceFactor={160} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <span className="-translate-y-6 whitespace-nowrap rounded-full border border-accent/60 bg-black/70 px-2 py-0.5 text-[11px] text-white">
          Central peak · {(metrics.centralPeakM / 1000).toFixed(1)} km above floor
        </span>
      </Html>
    </group>
  );
}

export default function TerrainScene(props: TerrainSceneProps) {
  const { terrain, metrics, exaggeration, layers } = props;
  const d = terrain.sideKm;
  return (
    <Canvas camera={{ position: [0, d * 0.42, d * 0.62], fov: 40, near: 0.5, far: d * 6 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={["#04050b"]} />
      <hemisphereLight args={["#dfe3ff", "#1b1d2a", layers.imagery ? 1.3 : 0.35]} />
      {/* A low Sun from the east, as a few days after first quarter: illustrative lighting for the relief. */}
      <directionalLight position={[d, d * 0.35, -d * 0.2]} intensity={layers.imagery ? 0.8 : 2.4} />
      <Surface {...props} />
      {layers.rim && metrics && <Rim terrain={terrain} metrics={metrics} exaggeration={exaggeration} />}
      {layers.peak && metrics && <Peak terrain={terrain} metrics={metrics} exaggeration={exaggeration} />}
      <OrbitControls enablePan={false} minDistance={d * 0.2} maxDistance={d * 1.6} maxPolarAngle={Math.PI * 0.47} rotateSpeed={0.5} />
    </Canvas>
  );
}
