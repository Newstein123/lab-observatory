"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { BarlowSpec, CameraSpec, EyepieceSpec, FilterSpec } from "@/modules/simulations/engine";
import { BarlowModel, CameraModel, FilterModel } from "./accessory-models";
import { barlowTrainDims, cameraTrainDims, eyepieceTrainDims, FILTER_TRAIN_DIMS, type TrainPartDims } from "./dimensions";
import { EyepieceModel } from "./eyepiece-model";
import { mm } from "./materials";
import { Part, type PartId } from "./parts";

/** What is in the focuser, from the telescope outwards. */
export interface TrainSpec {
  mode: "visual" | "imaging";
  barlow?: BarlowSpec;
  filter?: FilterSpec;
  /** Shown in visual mode. */
  eyepiece?: EyepieceSpec;
  /** Shown in imaging mode. */
  camera?: CameraSpec;
}

interface Slot {
  id: Extract<PartId, "barlow" | "filter" | "eyepiece" | "camera">;
  key: string;
  dims: TrainPartDims;
  node: React.ReactNode;
}

function slotsOf(train: TrainSpec): Slot[] {
  const slots: Slot[] = [];
  if (train.barlow) {
    slots.push({ id: "barlow", key: JSON.stringify(train.barlow), dims: barlowTrainDims(train.barlow.factor), node: <BarlowModel spec={train.barlow} /> });
  }
  if (train.filter) {
    slots.push({ id: "filter", key: JSON.stringify(train.filter), dims: FILTER_TRAIN_DIMS, node: <FilterModel spec={train.filter} mounted /> });
  }
  if (train.mode === "visual" && train.eyepiece) {
    slots.push({ id: "eyepiece", key: JSON.stringify(train.eyepiece), dims: eyepieceTrainDims(train.eyepiece), node: <EyepieceModel spec={train.eyepiece} /> });
  }
  if (train.mode === "imaging" && train.camera) {
    slots.push({ id: "camera", key: JSON.stringify(train.camera), dims: cameraTrainDims(train.camera), node: <CameraModel spec={train.camera} /> });
  }
  return slots;
}

/** How far a part travels when it is pulled out or pushed in, mm. */
const TRAVEL_MM = 260;
/** Seconds for each half of a swap (out, then in). */
const SWAP_S = 0.35;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The accessories stacked in the focuser, each sliding into place. When a
 * part changes, the old one slides out along the optical axis and the new
 * one slides in; parts above re-stack smoothly.
 */
export function OpticalTrain({ train }: { train: TrainSpec }) {
  const slots = slotsOf(train);
  let cursor = 0;
  const placed = slots.map((slot) => {
    const base = cursor - slot.dims.insert;
    cursor = base + slot.dims.length;
    return { ...slot, y: base + slot.dims.originFromBase };
  });
  const ids: Slot["id"][] = ["barlow", "filter", "eyepiece", "camera"];
  return (
    <group>
      {ids.map((id) => {
        const p = placed.find((x) => x.id === id);
        return <SwapSlot key={id} id={id} current={p} />;
      })}
    </group>
  );
}

interface ShownItem {
  key: string;
  node: React.ReactNode;
  flip: boolean;
  y: number;
  /** Slide in from outside (parts added after the first render). */
  enter: boolean;
}

const shown = (slot: Slot & { y: number }, enter: boolean): ShownItem => ({
  key: slot.key,
  node: slot.node,
  flip: Boolean(slot.dims.flip),
  y: slot.y,
  enter,
});

/** One position in the train; animates its contents in and out. */
function SwapSlot({ id, current }: { id: Slot["id"]; current?: Slot & { y: number } }) {
  const [items, setItems] = useState<ShownItem[]>(() => (current ? [shown(current, false)] : []));
  const firstRender = useRef(true);
  const currentKey = current?.key;

  // A new part (or none): keep the old one until it has slid out.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setItems((prev) => {
      const rest = prev.filter((i) => i.key !== currentKey);
      return current ? [...rest, shown(current, true)] : rest;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the identity of the part matters here
  }, [currentKey]);

  // Same part, new stack position (e.g. a Barlow went in below it).
  const y = current?.y;
  useEffect(() => {
    if (y === undefined) return;
    setItems((prev) => prev.map((i) => (i.key === currentKey ? { ...i, y } : i)));
  }, [y, currentKey]);

  const leavingCount = items.filter((i) => i.key !== currentKey).length;
  return (
    <Part id={id}>
      {items.map((item) => (
        <Animated
          key={item.key}
          item={item}
          leaving={item.key !== currentKey}
          // The new part waits for the old one to clear the drawtube.
          delay={item.key === currentKey && leavingCount > 0 ? SWAP_S : 0}
          onGone={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
        />
      ))}
    </Part>
  );
}

function Animated({
  item,
  leaving,
  delay,
  onGone,
}: {
  item: ShownItem;
  leaving: boolean;
  delay: number;
  onGone: () => void;
}) {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef({ offset: item.enter ? TRAVEL_MM : 0, y: item.y, t: 0 });

  useEffect(() => {
    state.current.t = 0;
    invalidate();
  }, [leaving, invalidate]);

  useFrame((_, dt) => {
    const st = state.current;
    const g = ref.current;
    if (!g) return;
    st.t += Math.min(dt, 0.05);
    let moving = false;
    if (leaving) {
      const k = Math.min(1, st.t / SWAP_S);
      st.offset = ease(k) * TRAVEL_MM;
      if (k >= 1) {
        onGone();
        return;
      }
      moving = true;
    } else if (st.offset > 0) {
      const k = Math.min(1, Math.max(0, (st.t - delay) / SWAP_S));
      st.offset = (1 - ease(k)) * TRAVEL_MM;
      moving = k < 1;
    }
    // Glide to a new stack position.
    const dy = item.y - st.y;
    if (Math.abs(dy) > 0.05) {
      st.y += dy * Math.min(1, dt * 10);
      moving = true;
    } else st.y = item.y;
    g.position.y = mm(st.y + st.offset);
    if (moving) invalidate();
  });

  return (
    <group ref={ref} position={[0, mm(item.y + state.current.offset), 0]}>
      <group rotation={item.flip ? [Math.PI, 0, 0] : [0, 0, 0]}>{item.node}</group>
    </group>
  );
}
