import type { EyepieceSpec, TelescopeOptics } from "@/modules/simulations/engine";

/**
 * Pure model proportions in millimetres (no three.js import), shared by the
 * 3D models and lightweight 2D renderings.
 */

export type TubeStyle = "refractor" | "newtonian" | "sct" | "maksutov";

export function tubeStyle(optics: TelescopeOptics): TubeStyle {
  if (optics.opticalDesign === "refractor") return "refractor";
  if (optics.opticalDesign === "catadioptric") return optics.focalLengthMm / optics.apertureMm > 11.5 ? "maksutov" : "sct";
  return "newtonian";
}

export interface OtaDimensions {
  style: TubeStyle;
  /** Tube outer radius, mm. */
  radius: number;
  /** Rear to front, mm. */
  length: number;
  /** Balance point from the rear, mm. */
  pivot: number;
}

export function otaDimensions(optics: TelescopeOptics): OtaDimensions {
  const A = optics.apertureMm;
  const F = optics.focalLengthMm;
  const style = tubeStyle(optics);
  switch (style) {
    case "refractor": {
      const tube = Math.max(F * 0.8, A * 3);
      const length = tube + A * 1.05;
      return { style, radius: A / 2 + 6, length, pivot: length * 0.42 };
    }
    case "newtonian": {
      const length = Math.max(F * 0.96, A * 3);
      return { style, radius: A / 2 + 16, length, pivot: length * 0.42 };
    }
    case "sct":
    case "maksutov": {
      const length = A * (style === "maksutov" ? 2.5 : 2.15);
      return { style, radius: A / 2 + 12, length, pivot: length * 0.5 };
    }
  }
}

/**
 * Eyepiece built from its specification: barrel diameter from the barrel
 * size, body girth from the apparent field, body length from field and eye
 * relief. Proportions are representative, not a specific product's drawing.
 */
export function eyepieceDimensions(spec: EyepieceSpec) {
  const barrelR = spec.barrelIn === 2 ? 25.4 : 15.875;
  const barrelLen = spec.barrelIn === 2 ? 38 : 30;
  const wide = Math.max(0, spec.apparentFovDeg - 50);
  const bodyR = barrelR + 7 + wide * 0.34;
  const bodyLen = 34 + wide * 0.55 + (spec.eyeReliefMm ?? 15) * 0.55;
  return { barrelR, barrelLen, bodyR, bodyLen, totalLen: barrelLen + bodyLen + 9 };
}


/**
 * Parts of the optical train as they sit in a focuser, mm. `length` runs
 * from the end that goes into the focuser (the base) to the far end;
 * `insert` is how much of that slides inside the part below; `originFromBase`
 * is where the model's own origin lies above the base (models are centred),
 * and `flip` turns a model whose mounting end faces up.
 */
export interface TrainPartDims {
  length: number;
  insert: number;
  originFromBase: number;
  flip?: boolean;
}

export function eyepieceTrainDims(spec: EyepieceSpec): TrainPartDims {
  const d = eyepieceDimensions(spec);
  const length = d.barrelLen + d.bodyLen + 9;
  return { length, insert: d.barrelLen * 0.85, originFromBase: length / 2 };
}

export function barlowTrainDims(factor: number): TrainPartDims {
  const len = 70 + factor * 18;
  return { length: len + 2, insert: len * 0.5, originFromBase: len / 2 };
}

/** A 1.25″ filter cell threaded onto the next part's barrel. */
export const FILTER_TRAIN_DIMS: TrainPartDims = { length: 9, insert: 0, originFromBase: 5 };

export function cameraTrainDims(spec: { sensorWidthMm: number; sensorHeightMm: number }): TrainPartDims & { kind: "fullframe" | "cooled" | "small" } {
  const diag = Math.hypot(spec.sensorWidthMm, spec.sensorHeightMm);
  if (diag > 32) {
    // Body from local −40 to +45 (lens mount up); flipped so the mount faces the focuser.
    return { kind: "fullframe", length: 130, insert: 0, originFromBase: 45, flip: true };
  }
  const cooled = diag > 12;
  const bodyLen = cooled ? 75 : 36;
  const centre = (bodyLen + (cooled ? 30 : 26)) / 2;
  const noseTop = cooled ? bodyLen + 8 : bodyLen + 33;
  const bottom = cooled ? -30 : 0;
  return {
    kind: cooled ? "cooled" : "small",
    length: noseTop - bottom,
    insert: cooled ? 0 : 22,
    originFromBase: noseTop - centre,
    flip: true,
  };
}

/** Size factor of a mount model from its payload rating. */
export function mountScale(payloadKg: number | undefined): number {
  return Math.min(1.5, Math.max(0.75, (payloadKg ?? 8) / 10));
}

/**
 * Equatorial-mount lever arms, mm, shared by the 3D model and the balance
 * calculation: the tube's centre sits `tubeArmMm` from the RA axis on one
 * side, the counterweight `counterweightMm(position)` on the other.
 */
export function equatorialArms(payloadKg: number | undefined, tubeRadiusMm: number) {
  const s = mountScale(payloadKg);
  const decOffset = 110 * s;
  return {
    s,
    decOffset,
    tubeArmMm: decOffset + 12 + tubeRadiusMm + 22,
    counterweightMm: (position: number) => 100 * s + 120 + Math.min(1, Math.max(0, position)) * 240,
  };
}
