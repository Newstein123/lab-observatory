"use client";

import type { TelescopeOptics } from "@/modules/simulations/engine";
import { otaDimensions } from "./dimensions";
import { materials, mm } from "./materials";
import { Part } from "./parts";

export { otaDimensions, tubeStyle, type OtaDimensions, type TubeStyle } from "./dimensions";

/**
 * Optical tube assembly built from aperture and focal length. The tube points
 * along +Y with its rear at y = 0; accessories mount on the −Z side
 * (dovetail), so mounts can attach it consistently.
 */

/** Drawtube travel, mm: how far the focuser can rack out. */
export const FOCUSER_TRAVEL_MM = 60;

/** Two tube rings and a dovetail bar on the −Z side. */
function RingsAndDovetail({ radius, from, to }: { radius: number; from: number; to: number }) {
  const m = materials();
  const len = to - from;
  return (
    <Part id="dovetail">
      {[from + len * 0.12, from + len * 0.88].map((y) => (
        <group key={y}>
          <mesh position={[0, mm(y), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.anodized} castShadow>
            <torusGeometry args={[mm(radius + 3), mm(4.5), 12, 72]} />
          </mesh>
          <mesh position={[0, mm(y), mm(-(radius + 10))]} material={m.anodized}>
            <boxGeometry args={[mm(22), mm(16), mm(16)]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, mm(from + len / 2), mm(-(radius + 22))]} material={m.satin} castShadow>
        <boxGeometry args={[mm(44), mm(len), mm(14)]} />
      </mesh>
    </Part>
  );
}

function Finder({ radius, y }: { radius: number; y: number }) {
  const m = materials();
  const x = radius + 34;
  return (
    <Part id="finder">
      <group position={[mm(x * 0.72), mm(y), mm(x * 0.72)]}>
        <mesh material={m.tubeDark} castShadow>
          <cylinderGeometry args={[mm(15), mm(15), mm(170), 32]} />
        </mesh>
        <mesh position={[0, mm(86), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}>
          <circleGeometry args={[mm(13), 32]} />
        </mesh>
        <mesh position={[mm(-14), mm(0), mm(-14)]} rotation={[0, Math.PI / 4, 0]} material={m.anodized}>
          <boxGeometry args={[mm(10), mm(60), mm(30)]} />
        </mesh>
      </group>
    </Part>
  );
}

/**
 * Rack-and-pinion / Crayford focuser along local +Y. The drawtube racks out
 * by `extension` mm and the knobs turn with it. Accessories sit in the open
 * end of the drawtube (`children`).
 */
function Focuser({ bodyR, extension, children }: { bodyR: number; extension: number; children?: React.ReactNode }) {
  const m = materials();
  const knobSpan = bodyR * 2 + 50;
  const drawtubeLen = extension + 50;
  return (
    <group>
      <Part id="focuser">
        <mesh position={[0, mm(30), 0]} material={m.anodized} castShadow>
          <cylinderGeometry args={[mm(bodyR), mm(bodyR), mm(60), 48]} />
        </mesh>
        {/* Drawtube: starts inside the body and racks out */}
        <mesh position={[0, mm(35 + drawtubeLen / 2), 0]} material={m.chrome} castShadow>
          <cylinderGeometry args={[mm(26), mm(26), mm(drawtubeLen), 48]} />
        </mesh>
        <mesh position={[0, mm(35 + drawtubeLen - 4), 0]} material={m.satin} castShadow>
          <cylinderGeometry args={[mm(29), mm(29), mm(8), 48]} />
        </mesh>
        {/* Pinion shaft and knobs; the accent mark shows them turning */}
        <group position={[0, mm(30), 0]} rotation={[extension * 0.12, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={m.satin} castShadow>
            <cylinderGeometry args={[mm(6), mm(6), mm(knobSpan), 16]} />
          </mesh>
          {[1, -1].map((side) => (
            <group key={side} position={[mm((side * knobSpan) / 2), 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} material={m.rubber} castShadow>
                <cylinderGeometry args={[mm(17), mm(17), mm(14), 20]} />
              </mesh>
              <mesh position={[0, mm(16), 0]} material={m.accent}>
                <boxGeometry args={[mm(15), mm(4), mm(3)]} />
              </mesh>
            </group>
          ))}
        </group>
      </Part>
      <group position={[0, mm(35 + drawtubeLen), 0]}>{children}</group>
    </group>
  );
}

export interface OtaProps {
  optics: TelescopeOptics;
  /** Omit the rings and dovetail (for Dobsonian bearings and yokes). */
  bare?: boolean;
  /** Drawtube racked out, mm (0 … FOCUSER_TRAVEL_MM). */
  focusMm?: number;
  /** Eyepiece/camera stack for the focuser, built along +Y from its base. */
  train?: React.ReactNode;
  /** Imaging trains attach straight through; visual ones on an SCT use the star diagonal. */
  trainMode?: "visual" | "imaging";
}

export function TelescopeOTA({ optics, bare = false, focusMm = 20, train, trainMode = "visual" }: OtaProps) {
  const m = materials();
  const A = optics.apertureMm;
  const d = otaDimensions(optics);
  const R = d.radius;

  if (d.style === "refractor") {
    const tube = d.length - A * 1.05;
    const dewLen = A * 1.4;
    const dewR = R + 5;
    const dewFrom = tube - dewLen * 0.25;
    return (
      <group>
        <Part id="tube">
          <mesh position={[0, mm(tube / 2), 0]} material={m.tubeWhite} castShadow>
            <cylinderGeometry args={[mm(R), mm(R), mm(tube), 72]} />
          </mesh>
          <mesh position={[0, mm(dewFrom + dewLen / 2), 0]} material={m.tubeWhite} castShadow>
            <cylinderGeometry args={[mm(dewR), mm(dewR), mm(dewLen), 72, 1, true]} />
          </mesh>
          <mesh position={[0, mm(dewFrom + dewLen / 2), 0]} material={m.tubeInterior}>
            <cylinderGeometry args={[mm(dewR - 1), mm(dewR - 1), mm(dewLen), 72, 1, true]} />
          </mesh>
          <mesh position={[0, mm(dewFrom + dewLen), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.flatBlack}>
            <torusGeometry args={[mm(dewR), mm(2), 8, 72]} />
          </mesh>
        </Part>
        <Part id="objective">
          <mesh position={[0, mm(tube + 1), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}>
            <circleGeometry args={[mm(A / 2), 72]} />
          </mesh>
          <mesh position={[0, mm(tube), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.gold}>
            <torusGeometry args={[mm(A / 2 + 1), mm(1.6), 8, 72]} />
          </mesh>
        </Part>
        {/* Focuser points backwards out of the rear of the tube. */}
        <group rotation={[Math.PI, 0, 0]}>
          <Focuser bodyR={Math.max(30, R * 0.62)} extension={focusMm}>
            {train}
          </Focuser>
        </group>
        {!bare && <RingsAndDovetail radius={R} from={tube * 0.18} to={tube * 0.78} />}
        <Finder radius={R} y={tube * 0.72} />
      </group>
    );
  }

  if (d.style === "newtonian") {
    const len = d.length;
    const spiderY = len - R * 0.9;
    return (
      <group>
        <Part id="tube">
          <mesh position={[0, mm(len / 2), 0]} material={m.tubeWhite} castShadow>
            <cylinderGeometry args={[mm(R), mm(R), mm(len), 72, 1, true]} />
          </mesh>
          <mesh position={[0, mm(len / 2), 0]} material={m.tubeInterior}>
            <cylinderGeometry args={[mm(R - 1.5), mm(R - 1.5), mm(len), 72, 1, true]} />
          </mesh>
          <mesh position={[0, mm(len), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.flatBlack}>
            <torusGeometry args={[mm(R), mm(3), 10, 72]} />
          </mesh>
        </Part>
        <Part id="objective">
          {/* Primary mirror cell */}
          <mesh position={[0, mm(-12), 0]} material={m.flatBlack} castShadow>
            <cylinderGeometry args={[mm(R + 1), mm(R + 1), mm(26), 72]} />
          </mesh>
          <mesh position={[0, mm(6), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.mirror}>
            <circleGeometry args={[mm(A / 2), 72]} />
          </mesh>
          {/* Spider and secondary */}
          {[0, Math.PI / 2].map((rot) => (
            <mesh key={rot} position={[0, mm(spiderY), 0]} rotation={[0, rot, 0]} material={m.flatBlack}>
              <boxGeometry args={[mm(2 * R - 4), mm(18), mm(1.2)]} />
            </mesh>
          ))}
          <mesh position={[0, mm(spiderY - A * 0.06), 0]} material={m.flatBlack}>
            <cylinderGeometry args={[mm(A * 0.13), mm(A * 0.13), mm(A * 0.24), 32]} />
          </mesh>
        </Part>
        {/* Side focuser near the front */}
        <group position={[mm(R), mm(spiderY), 0]} rotation={[0, 0, -Math.PI / 2]}>
          <Focuser bodyR={30} extension={focusMm}>
            {train}
          </Focuser>
        </group>
        {!bare && <RingsAndDovetail radius={R} from={len * 0.2} to={len * 0.75} />}
        <Finder radius={R} y={spiderY - 120} />
      </group>
    );
  }

  // Schmidt-Cassegrain / Maksutov-Cassegrain: focus moves the primary mirror.
  const len = d.length;
  const mak = d.style === "maksutov";
  return (
    <group>
      <Part id="tube">
        <mesh position={[0, mm(len / 2), 0]} material={m.tubeDark} castShadow>
          <cylinderGeometry args={[mm(R), mm(R), mm(len), 72]} />
        </mesh>
        <mesh position={[0, mm(len - 15), 0]} material={m.satin} castShadow>
          <cylinderGeometry args={[mm(R + 1.5), mm(R + 1.5), mm(30), 72]} />
        </mesh>
        <mesh position={[0, mm(-20), 0]} material={m.anodized} castShadow>
          <cylinderGeometry args={[mm(R * 0.96), mm(R), mm(40), 72]} />
        </mesh>
      </Part>
      <Part id="objective">
        <mesh position={[0, mm(len + 0.6), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}>
          <circleGeometry args={[mm(A / 2), 72]} />
        </mesh>
        {mak ? (
          <mesh position={[0, mm(len + 1.2), 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.mirror}>
            <circleGeometry args={[mm(A * 0.14), 48]} />
          </mesh>
        ) : (
          <group position={[0, mm(len + 6), 0]}>
            <mesh material={m.flatBlack}>
              <cylinderGeometry args={[mm(A * 0.17), mm(A * 0.19), mm(14), 48]} />
            </mesh>
            <mesh position={[0, mm(7.2), 0]} rotation={[Math.PI / 2, 0, 0]} material={m.satin}>
              <torusGeometry args={[mm(A * 0.17), mm(1.2), 8, 48]} />
            </mesh>
          </group>
        )}
      </Part>
      <Part id="focuser">
        {/* Visual back */}
        <mesh position={[0, mm(-60), 0]} material={m.satin}>
          <cylinderGeometry args={[mm(22), mm(22), mm(40), 32]} />
        </mesh>
        {/* Focus knob on the rear cell */}
        <group position={[mm(R * 0.7), mm(-24), mm(R * 0.5)]} rotation={[Math.PI / 2, focusMm * 0.12, 0]}>
          <mesh material={m.rubber}>
            <cylinderGeometry args={[mm(13), mm(13), mm(20), 12]} />
          </mesh>
          <mesh position={[mm(11), 0, 0]} material={m.accent}>
            <boxGeometry args={[mm(5), mm(21), mm(3)]} />
          </mesh>
        </group>
      </Part>
      {trainMode === "visual" ? (
        <>
          <Part id="diagonal">
            <mesh position={[0, mm(-102), 0]} rotation={[0, 0, Math.PI / 4]} material={m.anodized} castShadow>
              <boxGeometry args={[mm(46), mm(46), mm(42)]} />
            </mesh>
            <mesh position={[mm(42), mm(-102), 0]} rotation={[0, 0, Math.PI / 2]} material={m.chrome}>
              <cylinderGeometry args={[mm(17), mm(17), mm(50), 32]} />
            </mesh>
          </Part>
          <group position={[mm(67), mm(-102), 0]} rotation={[0, 0, -Math.PI / 2]}>
            {train}
          </group>
        </>
      ) : (
        <group position={[0, mm(-80), 0]} rotation={[Math.PI, 0, 0]}>
          {train}
        </group>
      )}
      {!bare && <RingsAndDovetail radius={R} from={len * 0.08} to={len * 0.92} />}
      <Finder radius={R} y={len * 0.6} />
    </group>
  );
}
