"use client";

import { Html, Line } from "@react-three/drei";
import type { MountSpec } from "@/modules/equipment/models";
import type { TelescopeOptics } from "@/modules/simulations/engine";
import { materials, mm } from "./materials";
import { equatorialArms, mountScale, otaDimensions } from "./dimensions";
import { Part } from "./parts";
import { TelescopeOTA, type OtaProps } from "./telescope-model";

/**
 * Mounts, optionally carrying an optical tube. The tube attaches on its −Z
 * side (dovetail) and pivots about the Z axis (altitude / declination).
 *
 * Scene orientation: +Y is up and +X is north, so an equatorial mount's
 * polar axis points along +X, raised by the latitude setting.
 */

const D2R = Math.PI / 180;

/** How a mount is set and pointed. Every field has a sensible default. */
export interface MountPose {
  /** Equatorial: polar-axis elevation set with the latitude bolts, degrees. */
  latitudeDeg?: number;
  /** Equatorial: head turned from true north by the azimuth bolts, degrees (east +). */
  polarAzimuthDeg?: number;
  /** Equatorial: rotation about the polar (RA) axis, degrees; 0 = counterweight down. */
  raDeg?: number;
  /** Equatorial: declination the tube points at, degrees; 90 = parallel to the polar axis. */
  decDeg?: number;
  /** Equatorial: counterweight position along the shaft, 0 (inner) … 1 (outer). */
  counterweight?: number;
  /** Equatorial: how many counterweights are on the shaft. */
  counterweights?: number;
  /** Alt-az and Dobsonian: tube altitude above the horizon, degrees. */
  altitudeDeg?: number;
  /** Alt-az and Dobsonian: azimuth, degrees. */
  azimuthDeg?: number;
}

export const DEFAULT_POSE: Required<MountPose> = {
  latitudeDeg: 45,
  polarAzimuthDeg: 0,
  raDeg: 90,
  decDeg: 84,
  counterweight: 0.75,
  counterweights: 1,
  altitudeDeg: 40,
  azimuthDeg: 0,
};

function Tripod({ height, spread = 0.36 }: { height: number; spread?: number }) {
  const m = materials();
  const leg = height / Math.cos(spread);
  return (
    <Part id="tripod">
      <group position={[0, mm(height), 0]}>
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
          <group key={a} rotation={[0, a, 0]}>
            <group rotation={[0, 0, spread]}>
              <mesh position={[0, mm(-leg / 2), 0]} material={m.satin} castShadow>
                <cylinderGeometry args={[mm(14), mm(11), mm(leg), 16]} />
              </mesh>
              <mesh position={[0, mm(-leg + 30), 0]} material={m.rubber}>
                <cylinderGeometry args={[mm(13), mm(16), mm(60), 16]} />
              </mesh>
            </group>
          </group>
        ))}
        <mesh position={[0, mm(-height * 0.55), 0]} material={m.anodized}>
          <cylinderGeometry args={[mm(height * 0.17), mm(height * 0.17), mm(8), 3]} />
        </mesh>
        <mesh position={[0, mm(10), 0]} material={m.anodized} castShadow>
          <cylinderGeometry args={[mm(62), mm(70), mm(40), 32]} />
        </mesh>
      </group>
    </Part>
  );
}

/** Places a tube so its balance point sits at the pivot. */
function MountedTube({ optics, tilt, ota }: { optics: TelescopeOptics; tilt: number; ota?: Partial<OtaProps> }) {
  const d = otaDimensions(optics);
  return (
    <group rotation={[0, 0, -tilt]}>
      <group position={[0, mm(-d.pivot), 0]}>
        <TelescopeOTA {...ota} optics={optics} />
      </group>
    </group>
  );
}

/** Ground arrow to true north and a guide line to the celestial pole. */
function PoleGuide({ origin, siteLatitudeDeg }: { origin: [number, number, number]; siteLatitudeDeg: number }) {
  const lat = siteLatitudeDeg * D2R;
  const len = mm(2600);
  const end: [number, number, number] = [origin[0] + Math.cos(lat) * len, origin[1] + Math.sin(lat) * len, origin[2]];
  return (
    <group>
      <Line points={[origin, end]} color="#f5c451" lineWidth={1.5} dashed dashSize={0.12} gapSize={0.08} />
      <Html position={end} center style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-[#f5c451]">★ Celestial pole</span>
      </Html>
      <Line points={[[0, 0.01, 0], [mm(1100), 0.01, 0]]} color="#8b96ff" lineWidth={2} />
      <Html position={[mm(1180), 0.02, 0]} center style={{ pointerEvents: "none" }}>
        <span className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-[#8b96ff]">N</span>
      </Html>
    </group>
  );
}

export interface MountModelProps {
  spec: MountSpec;
  optics?: TelescopeOptics;
  pose?: MountPose;
  /** Focus, optical train… passed to the tube. */
  ota?: Partial<OtaProps>;
  /** Draw north and the celestial pole for polar alignment (equatorial only). */
  poleGuide?: { siteLatitudeDeg: number };
}

export function MountModel({ spec, optics, pose: poseIn, ota, poleGuide }: MountModelProps) {
  const m = materials();
  const pose = { ...DEFAULT_POSE, ...poseIn };
  const d = optics ? otaDimensions(optics) : undefined;
  const R = d?.radius ?? 100;
  const s = mountScale(spec.payloadKg);

  if (spec.type === "dobsonian") {
    // Like a real rocker box, tall enough that the back of the tube (with the
    // focuser and whatever is in it) clears the ground board at any altitude,
    // even pointing straight up: the pivot sits at least that reach above it.
    const rearReach = d ? d.pivot + (d.style === "newtonian" ? 40 : 170) : 0;
    const sideH = Math.max(R + 140, Math.hypot(rearReach, R) + 40);
    const width = 2 * R + 90;
    const pivotY = sideH;
    return (
      <group>
        <Part id="dob-base">
          <mesh position={[0, mm(14), 0]} material={m.wood} castShadow receiveShadow>
            <cylinderGeometry args={[mm(R + 90), mm(R + 90), mm(28), 64]} />
          </mesh>
        </Part>
        <group rotation={[0, pose.azimuthDeg * D2R, 0]}>
          <Part id="dob-base">
            {[1, -1].map((side) => (
              <group key={side}>
                <mesh position={[0, mm(30 + sideH / 2), mm(side * (R + 45))]} material={m.wood} castShadow>
                  <boxGeometry args={[mm(width), mm(sideH), mm(20)]} />
                </mesh>
                <mesh position={[0, mm(pivotY), mm(side * (R + 26))]} rotation={[Math.PI / 2, 0, 0]} material={m.anodizedLight} castShadow>
                  <cylinderGeometry args={[mm(R * 0.5), mm(R * 0.5), mm(18), 48]} />
                </mesh>
              </group>
            ))}
            <mesh position={[mm(-width / 2 + 10), mm(30 + sideH * 0.3), 0]} material={m.wood} castShadow>
              <boxGeometry args={[mm(20), mm(sideH * 0.6), mm(2 * R + 110)]} />
            </mesh>
            <mesh position={[0, mm(36), 0]} material={m.wood}>
              <boxGeometry args={[mm(width), mm(14), mm(2 * R + 110)]} />
            </mesh>
          </Part>
          {optics && (
            <group position={[0, mm(pivotY), 0]}>
              <MountedTube optics={optics} tilt={Math.PI / 2 - pose.altitudeDeg * D2R} ota={{ ...ota, bare: true }} />
            </group>
          )}
        </group>
      </group>
    );
  }

  if (spec.type === "equatorial") {
    const H = 900;
    const arms = equatorialArms(spec.payloadKg, R);
    const decOffset = arms.decOffset;
    const cw = arms.counterweightMm(pose.counterweight);
    const headY = H + 30;
    return (
      <group>
        <Tripod height={H} />
        {poleGuide && <PoleGuide origin={[0, mm(headY), 0]} siteLatitudeDeg={poleGuide.siteLatitudeDeg} />}
        {/* Azimuth: the whole head turns on the tripod (azimuth bolts) */}
        <group position={[0, mm(headY), 0]} rotation={[0, -pose.polarAzimuthDeg * D2R, 0]}>
          <Part id="azimuth-adjuster">
            {[1, -1].map((side) => (
              <mesh key={side} position={[mm(-40 * s), mm(-6), mm(side * 50 * s)]} rotation={[0, 0, Math.PI / 2]} material={m.chrome}>
                <cylinderGeometry args={[mm(6), mm(6), mm(60 * s), 12]} />
              </mesh>
            ))}
          </Part>
          {/* Latitude: the head tilts so the polar axis rises to the latitude */}
          <group rotation={[0, 0, -(Math.PI / 2 - pose.latitudeDeg * D2R)]}>
            {poleGuide && (
              // Where the polar axis actually points; aligning makes it meet the gold line.
              <>
                <Line points={[[0, 0, 0], [0, mm(2600), 0]]} color="#8b96ff" lineWidth={2} />
                <Html position={[0, mm(2700), 0]} center style={{ pointerEvents: "none" }}>
                  <span className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-[#aab3ff]">Polar axis</span>
                </Html>
              </>
            )}
            <Part id="latitude-adjuster">
              {[1, -1].map((side) => (
                <mesh key={side} position={[mm(side * 34 * s), mm(-14 * s), mm(46 * s)]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
                  <cylinderGeometry args={[mm(6), mm(6), mm(36), 12]} />
                </mesh>
              ))}
              <mesh position={[0, mm(-14 * s), mm(64 * s)]} rotation={[Math.PI / 2, 0, 0]} material={m.rubber}>
                <cylinderGeometry args={[mm(14), mm(14), mm(10), 16]} />
              </mesh>
            </Part>
            <Part id="ra-axis">
              {/* Right-ascension (polar) axis housing */}
              <mesh position={[0, mm(100 * s), 0]} material={m.anodizedLight} castShadow>
                <cylinderGeometry args={[mm(46 * s), mm(52 * s), mm(220 * s), 40]} />
              </mesh>
              {spec.goto && (
                <mesh position={[mm(56 * s), mm(80 * s), 0]} material={m.anodized} castShadow>
                  <boxGeometry args={[mm(40 * s), mm(90 * s), mm(70 * s)]} />
                </mesh>
              )}
            </Part>
            {/* Everything that turns about the RA axis */}
            <group position={[0, mm(225 * s), 0]} rotation={[0, (pose.raDeg - 90) * D2R, 0]}>
              <Part id="dec-axis">
                <mesh rotation={[Math.PI / 2, 0, 0]} material={m.anodizedLight} castShadow>
                  <cylinderGeometry args={[mm(40 * s), mm(40 * s), mm(200 * s), 40]} />
                </mesh>
                <mesh position={[0, 0, mm(decOffset)]} material={m.satin} castShadow>
                  <boxGeometry args={[mm(70 * s), mm(150 * s), mm(24)]} />
                </mesh>
              </Part>
              <Part id="counterweight">
                <mesh position={[0, 0, mm(-(100 * s + 190))]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
                  <cylinderGeometry args={[mm(10), mm(10), mm(380), 16]} />
                </mesh>
                {/* Several weights sit side by side, centred on the balance position */}
                {Array.from({ length: pose.counterweights }, (_, i) => (
                  <mesh
                    key={i}
                    position={[0, 0, mm(-cw - (i - (pose.counterweights - 1) / 2) * 74 * s)]}
                    rotation={[Math.PI / 2, 0, 0]}
                    material={m.satin}
                    castShadow
                  >
                    <cylinderGeometry args={[mm(56 * s), mm(56 * s), mm(70 * s), 40]} />
                  </mesh>
                ))}
              </Part>
              {optics && (
                <group position={[0, 0, mm(arms.tubeArmMm)]}>
                  <MountedTube optics={optics} tilt={(90 - pose.decDeg) * D2R} ota={ota} />
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    );
  }

  // Alt-azimuth: single GoTo arm or a manual yoke.
  const H = 820;
  const armH = Math.max(320, R * 1.4 + 160);
  const pivotY = H + 40 + armH - 70;
  const singleArm = spec.goto || spec.type === "goto";
  return (
    <group>
      <Tripod height={H} />
      <group rotation={[0, pose.azimuthDeg * D2R, 0]}>
        <Part id="altaz-head">
          <mesh position={[0, mm(H + 45), 0]} material={m.anodized} castShadow>
            <cylinderGeometry args={[mm(R * 0.7 + 40), mm(R * 0.7 + 50), mm(50), 48]} />
          </mesh>
          {singleArm ? (
            <group>
              <mesh position={[0, mm(H + 70 + armH / 2), mm(-(R + 58))]} material={m.anodized} castShadow>
                <boxGeometry args={[mm(110), mm(armH), mm(60)]} />
              </mesh>
              <mesh position={[mm(30), mm(H + 70 + armH * 0.55), mm(-(R + 27))]} material={m.anodizedLight}>
                <boxGeometry args={[mm(36), mm(70), mm(4)]} />
              </mesh>
            </group>
          ) : (
            [1, -1].map((side) => (
              <mesh key={side} position={[0, mm(H + 70 + armH / 2), mm(side * (R + 40))]} material={m.satin} castShadow>
                <boxGeometry args={[mm(60), mm(armH), mm(22)]} />
              </mesh>
            ))
          )}
        </Part>
        {optics && (
          <group position={[0, mm(pivotY), 0]}>
            <MountedTube optics={optics} tilt={Math.PI / 2 - pose.altitudeDeg * D2R} ota={{ ...ota, bare: !singleArm }} />
          </group>
        )}
      </group>
    </group>
  );
}
