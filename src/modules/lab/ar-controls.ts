/**
 * Hands-on controls for the interactive AR view: what dragging or tapping
 * each part of the telescope does. Pure functions, so the feel can be tuned
 * and tested without a device.
 */
import type { PartId } from "@/components/equipment-3d/parts";
import type { MountType } from "@/modules/equipment/models";
import type { TrainMode } from "./workbench";

/** Everything the user can change by hand in AR. */
export interface RigControls {
  mode: TrainMode;
  /** Eyepiece (visual) or camera (imaging) in the focuser. */
  topIn: boolean;
  barlowIn: boolean;
  filterIn: boolean;
  /** Drawtube racked out, mm. */
  focusMm: number;
  latitudeDeg: number;
  polarAzimuthDeg: number;
  raDeg: number;
  decDeg: number;
  /** Counterweight position along the shaft, 0…1. */
  counterweight: number;
  altitudeDeg: number;
  azimuthDeg: number;
}

export type DragControl = "focus" | "counterweight" | "ra" | "dec" | "latitude" | "azimuth" | "altitude" | "slew";

/** What a drag on this part adjusts (undefined: the part only shows information). */
export function dragControlFor(part: PartId, mountType: MountType | undefined): DragControl | undefined {
  const eq = mountType === "equatorial";
  switch (part) {
    case "focuser":
      return "focus";
    case "counterweight":
      return eq ? "counterweight" : undefined;
    case "ra-axis":
      return eq ? "ra" : undefined;
    case "dec-axis":
      return eq ? "dec" : undefined;
    case "latitude-adjuster":
      return eq ? "latitude" : undefined;
    case "azimuth-adjuster":
      return eq ? "azimuth" : undefined;
    case "tube":
    case "dovetail":
    case "objective":
    case "finder":
      // Push the tube up or down: declination on an equatorial mount, altitude otherwise.
      return !mountType ? undefined : eq ? "dec" : "altitude";
    case "altaz-head":
    case "dob-base":
      return "slew";
    default:
      return undefined;
  }
}

/** What tapping this part takes in or out of the focuser. */
export function toggleFor(part: PartId): "top" | "barlow" | "filter" | undefined {
  if (part === "eyepiece" || part === "camera") return "top";
  if (part === "barlow") return "barlow";
  if (part === "filter") return "filter";
  return undefined;
}

export const DRAG_HINTS: Record<DragControl, string> = {
  focus: "Drag sideways to turn the focus knob",
  counterweight: "Drag sideways to slide the counterweight",
  ra: "Drag sideways to swing the RA axis",
  dec: "Drag up or down to move the tube in declination",
  latitude: "Drag up or down to turn the latitude bolts",
  azimuth: "Drag sideways to turn the azimuth bolts",
  altitude: "Drag up or down to tilt the tube",
  slew: "Drag sideways to turn the mount",
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Wrap to −180…180°. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Apply a finger movement (screen pixels since the last move; dy positive
 * downwards) to the control being dragged. Sensitivities are chosen so a
 * thumb-width drag makes a visible but controllable change.
 */
export function applyDrag(state: RigControls, control: DragControl, dx: number, dy: number, focusTravelMm = 60): RigControls {
  switch (control) {
    case "focus":
      return { ...state, focusMm: clamp(state.focusMm + dx * 0.08, 0, focusTravelMm) };
    case "counterweight":
      return { ...state, counterweight: clamp(state.counterweight + dx * 0.004, 0, 1) };
    case "ra":
      return { ...state, raDeg: wrap(state.raDeg + dx * 0.5) };
    case "dec":
      return { ...state, decDeg: clamp(state.decDeg - dy * 0.4, -60, 90) };
    case "latitude":
      return { ...state, latitudeDeg: clamp(state.latitudeDeg - dy * 0.05, 0, 90) };
    case "azimuth":
      return { ...state, polarAzimuthDeg: clamp(state.polarAzimuthDeg + dx * 0.04, -20, 20) };
    case "altitude":
      return { ...state, altitudeDeg: clamp(state.altitudeDeg - dy * 0.3, 5, 90) };
    case "slew":
      return { ...state, azimuthDeg: wrap(state.azimuthDeg + dx * 0.4) };
  }
}

/** The view starting yaw (radians) that shows a rig from its side, given where the viewer stands. */
export function facingYaw(rigX: number, rigZ: number, viewerX: number, viewerZ: number): number {
  // In the rig's own frame the viewer should be at −33° (its south-west side),
  // where an equatorial mount's head and counterweight aren't hidden by the tube.
  const viewerAngle = Math.atan2(viewerZ - rigZ, viewerX - rigX);
  return (-33 * Math.PI) / 180 - viewerAngle;
}
