"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import type { Group } from "three";

/** Named parts of a telescope setup, for learning and camera framing. */
export type PartId =
  | "tube"
  | "objective"
  | "focuser"
  | "finder"
  | "dovetail"
  | "diagonal"
  | "eyepiece"
  | "camera"
  | "barlow"
  | "filter"
  | "tripod"
  | "ra-axis"
  | "dec-axis"
  | "counterweight"
  | "latitude-adjuster"
  | "azimuth-adjuster"
  | "altaz-head"
  | "dob-base";

interface PartContextValue {
  /** Click handler; parts are only interactive when it is set. */
  onSelect?: (id: PartId) => void;
  /** Press (pointer down) on a part, e.g. to start dragging a knob in AR. */
  onPress?: (id: PartId) => void;
  register?: (id: PartId, object: Group | null) => void;
}

export const PartContext = createContext<PartContextValue>({});

/** Wraps a part's meshes so it can be clicked, highlighted and framed by the camera. */
export function Part({ id, children }: { id: PartId; children: React.ReactNode }) {
  const { onSelect, onPress, register } = useContext(PartContext);
  const ref = useRef<Group>(null);
  useEffect(() => {
    register?.(id, ref.current);
    return () => register?.(id, null);
  }, [id, register]);
  return (
    <group
      ref={ref}
      name={id}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect(id);
            }
          : undefined
      }
      onPointerDown={
        onPress
          ? (e) => {
              e.stopPropagation();
              onPress(id);
            }
          : undefined
      }
      onPointerOver={
        onSelect
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }
          : undefined
      }
      onPointerOut={onSelect ? () => (document.body.style.cursor = "") : undefined}
    >
      {children}
    </group>
  );
}
