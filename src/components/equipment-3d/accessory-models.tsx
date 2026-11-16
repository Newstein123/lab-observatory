"use client";

import { useEffect, useMemo } from "react";
import type { BarlowSpec, CameraSpec, FilterSpec } from "@/modules/simulations/engine";
import { filterGlass, labelTexture, lathe, materials, mm } from "./materials";

/**
 * Astronomy camera sized from its sensor: large sensors get a cooled body
 * with heat-sink fins; small planetary sensors a compact body with a 1.25″
 * nosepiece; very large sensors a camera-body shape.
 */
export function CameraModel({ spec }: { spec: CameraSpec }) {
  const m = materials();
  const diag = Math.hypot(spec.sensorWidthMm, spec.sensorHeightMm);
  const sensor = (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.sensor}>
      <planeGeometry args={[mm(spec.sensorWidthMm), mm(spec.sensorHeightMm)]} />
    </mesh>
  );

  if (diag > 32) {
    // Full-frame body (DSLR / mirrorless style), lens mount facing up.
    return (
      <group position={[0, mm(-40), 0]}>
        <mesh position={[0, mm(35), 0]} material={m.anodized} castShadow>
          <boxGeometry args={[mm(132), mm(70), mm(92)]} />
        </mesh>
        <mesh position={[mm(-58), mm(35), mm(-8)]} material={m.rubber} castShadow>
          <boxGeometry args={[mm(30), mm(74), mm(88)]} />
        </mesh>
        <mesh position={[mm(10), mm(76), 0]} material={m.satin}>
          <cylinderGeometry args={[mm(27), mm(27), mm(12), 48]} />
        </mesh>
        <group position={[mm(10), mm(70.5), 0]}>{sensor}</group>
        <mesh position={[mm(10), mm(83), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
          <torusGeometry args={[mm(27), mm(1.4), 8, 48]} />
        </mesh>
      </group>
    );
  }

  const cooled = diag > 12;
  const R = cooled ? 45 + Math.max(0, diag - 20) * 0.6 : 31;
  const bodyLen = cooled ? 75 : 36;
  const fins = cooled ? 18 : 0;
  return (
    <group position={[0, mm(-(bodyLen + (cooled ? 30 : 26)) / 2), 0]}>
      {/* Body, sensor end up */}
      <mesh position={[0, mm(bodyLen / 2), 0]} material={cooled ? m.tubeDark : m.anodized} castShadow>
        <cylinderGeometry args={[mm(R), mm(R), mm(bodyLen), 64]} />
      </mesh>
      <mesh position={[0, mm(bodyLen * 0.62), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}>
        <torusGeometry args={[mm(R + 0.3), mm(0.8), 8, 64]} />
      </mesh>
      {cooled && (
        <group position={[0, mm(-14), 0]}>
          {Array.from({ length: fins }, (_, i) => (
            <mesh key={i} rotation={[0, (i / fins) * Math.PI * 2, 0]} position={[0, 0, 0]} material={m.anodized}>
              <boxGeometry args={[mm(3), mm(28), mm(2 * R - 6)]} />
            </mesh>
          ))}
          <mesh position={[0, mm(-15), 0]} material={m.flatBlack}>
            <cylinderGeometry args={[mm(R - 4), mm(R - 4), mm(3), 48]} />
          </mesh>
        </group>
      )}
      {/* Front: T-thread ring (or nosepiece), window and sensor */}
      <mesh position={[0, mm(bodyLen + 4), 0]} material={m.satin}>
        <cylinderGeometry args={[mm(cooled ? 26 : 22), mm(cooled ? 28 : 24), mm(8), 48]} />
      </mesh>
      {!cooled && (
        <mesh position={[0, mm(bodyLen + 20), 0]} material={m.chrome} castShadow>
          <cylinderGeometry args={[mm(15.875), mm(15.875), mm(26), 48]} />
        </mesh>
      )}
      <group position={[0, mm(bodyLen + 0.5), 0]}>{sensor}</group>
      <mesh position={[0, mm(bodyLen + (cooled ? 8.2 : 33.2)), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}>
        <circleGeometry args={[mm(cooled ? 24 : 14), 48]} />
      </mesh>
    </group>
  );
}

export function BarlowModel({ spec }: { spec: BarlowSpec }) {
  const m = materials();
  const r = spec.barrelIn === 2 ? 25.4 : 15.875;
  const len = 70 + spec.factor * 18;
  const bodyR = r + 6;
  const geo = useMemo(
    () => ({
      barrel: lathe([
        [0, 0],
        [r, 0],
        [r, len * 0.55],
        [0, len * 0.55],
      ]),
      body: lathe([
        [0, len * 0.55],
        [bodyR, len * 0.56],
        [bodyR, len],
        [bodyR - 2, len + 2],
        [r - 1, len + 2],
        [r - 1, len - 8],
        [0, len - 8],
      ]),
    }),
    [r, len, bodyR],
  );
  const text = `${spec.factor}×`;
  const tex = useMemo(() => labelTexture(text, 3), [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, mm(-len / 2), 0]}>
      <mesh geometry={geo.barrel} material={m.chrome} castShadow />
      <mesh geometry={geo.body} material={m.anodized} castShadow />
      <mesh position={[0, mm(len * 0.78), 0]}>
        <cylinderGeometry args={[mm(bodyR + 0.05), mm(bodyR + 0.05), mm(7), 72, 1, true]} />
        <meshStandardMaterial map={tex} transparent depthWrite={false} metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[mm(bodyR + 5), mm(len * 0.9), 0]} rotation={[0, 0, Math.PI / 2]} material={m.satin}>
        <cylinderGeometry args={[mm(4), mm(4), mm(10), 16]} />
      </mesh>
      <mesh position={[0, mm(2), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
        <circleGeometry args={[mm(r - 2), 48]} />
      </mesh>
    </group>
  );
}

/** `mounted`: upright, as threaded into the optical train (otherwise tilted for display). */
export function FilterModel({ spec, mounted = false }: { spec: FilterSpec; mounted?: boolean }) {
  const m = materials();
  const r = 15.5; // 1.25″ filter cell
  const glass = useMemo(() => filterGlass(spec.kind), [spec.kind]);
  useEffect(() => () => glass.dispose(), [glass]);
  return (
    <group rotation={mounted ? [0, 0, 0] : [Math.PI / 2.6, 0, 0]}>
      <mesh material={m.anodized} castShadow>
        <cylinderGeometry args={[mm(r + 2.5), mm(r + 2.5), mm(6), 64, 1, true]} />
      </mesh>
      <mesh position={[0, mm(-5), 0]} material={m.satin}>
        <cylinderGeometry args={[mm(r), mm(r), mm(5), 64, 1, true]} />
      </mesh>
      <mesh position={[0, mm(3), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.anodized}>
        <torusGeometry args={[mm(r + 1.2), mm(1.3), 8, 64]} />
      </mesh>
      <mesh material={glass}>
        <cylinderGeometry args={[mm(r + 0.5), mm(r + 0.5), mm(2), 64]} />
      </mesh>
    </group>
  );
}
