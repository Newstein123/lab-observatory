"use client";

import { useEffect, useMemo } from "react";
import type { EyepieceSpec } from "@/modules/simulations/engine";
import { eyepieceDimensions } from "./dimensions";
import { labelTexture, lathe, materials, mm } from "./materials";

export { eyepieceDimensions } from "./dimensions";

export function EyepieceModel({ spec }: { spec: EyepieceSpec }) {
  const m = materials();
  const { barrelR, barrelLen, bodyR, bodyLen } = eyepieceDimensions(spec);
  const top = barrelLen + bodyLen;

  const geo = useMemo(
    () => ({
      barrel: lathe([
        [0, 0],
        [barrelR - 0.6, 0],
        [barrelR, 0.6],
        [barrelR, barrelLen * 0.32],
        [barrelR - 1.1, barrelLen * 0.36],
        [barrelR - 1.1, barrelLen * 0.46],
        [barrelR, barrelLen * 0.5],
        [barrelR, barrelLen + 1],
        [0, barrelLen + 1],
      ]),
      body: lathe([
        [0, barrelLen],
        [barrelR + 2, barrelLen],
        [bodyR - 2.5, barrelLen + 1.2],
        [bodyR, barrelLen + 4],
        [bodyR, top - 6],
        [bodyR - 1.5, top - 3],
        [bodyR - 3, top],
        [0, top],
      ]),
      eyecup: lathe([
        [bodyR * 0.62, top - 0.5],
        [bodyR - 2.6, top - 0.5],
        [bodyR - 2.2, top + 7],
        [bodyR - 3.6, top + 9],
        [bodyR * 0.66, top + 9],
        [bodyR * 0.62, top + 3],
      ]),
    }),
    [barrelR, barrelLen, bodyR, top],
  );

  const text = `${spec.focalLengthMm} mm  ·  ${spec.apparentFovDeg}°`;
  const tex = useMemo(() => labelTexture(text), [text]);
  useEffect(() => () => tex.dispose(), [tex]);

  const gripY = barrelLen + bodyLen * 0.52;
  const gripH = bodyLen * 0.34;
  const ribs = Math.max(5, Math.round(gripH / 2.4));

  return (
    // Centre the eyepiece vertically on the turntable.
    <group position={[0, mm(-(top + 9) / 2), 0]}>
      <mesh geometry={geo.barrel} material={m.chrome} castShadow />
      <mesh geometry={geo.body} material={m.anodized} castShadow />
      {/* Ribbed rubber grip */}
      {Array.from({ length: ribs }, (_, i) => (
        <mesh
          key={i}
          position={[0, mm(gripY - gripH / 2 + (i + 0.5) * (gripH / ribs)), 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={m.rubber}
          castShadow
        >
          <torusGeometry args={[mm(bodyR + 0.2), mm(0.95), 10, 72]} />
        </mesh>
      ))}
      <mesh position={[0, mm(gripY), 0]} material={m.rubber}>
        <cylinderGeometry args={[mm(bodyR + 0.15), mm(bodyR + 0.15), mm(gripH), 72, 1, true]} />
      </mesh>
      {/* Engraved label band and accent ring */}
      <mesh position={[0, mm(barrelLen + bodyLen * 0.2), 0]}>
        <cylinderGeometry args={[mm(bodyR + 0.05), mm(bodyR + 0.05), mm(6), 96, 1, true]} />
        <meshStandardMaterial map={tex} transparent metalness={0.2} roughness={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[0, mm(barrelLen + 4.5), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}>
        <torusGeometry args={[mm(bodyR + 0.05), mm(0.5), 8, 72]} />
      </mesh>
      <mesh geometry={geo.eyecup} material={m.rubber} castShadow />
      {/* Eye lens and field lens */}
      <mesh position={[0, mm(top + 1.2), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}>
        <circleGeometry args={[mm(bodyR * 0.62), 64]} />
      </mesh>
      <mesh position={[0, mm(0.2), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
        <circleGeometry args={[mm(barrelR - 2), 48]} />
      </mesh>
    </group>
  );
}
