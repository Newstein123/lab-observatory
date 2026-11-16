"use client";

import { useId } from "react";
import { inputClass, NumberField, SelectField } from "@/components/ui/fields";
import { friendlyMessage } from "@/lib/validation-messages";
import { mountSpecSchema, MOUNT_TYPES, type AccessoryKind, type AccessorySpecPair, type MountSpec, type MountType } from "@/modules/equipment/models";
import {
  barlowSpecSchema,
  cameraSpecSchema,
  eyepieceSpecSchema,
  filterSpecSchema,
  FILTER_KINDS,
  type FilterKind,
} from "@/modules/simulations/engine";

export const FILTER_KIND_LABELS: Record<FilterKind, string> = {
  neutral_density: "Neutral density (Moon)",
  uhc: "UHC (nebula)",
  oiii: "OIII (nebula)",
  light_pollution: "Light-pollution",
  color_blue: "Colour: blue",
  color_orange: "Colour: orange",
  other: "Other",
};

export const ACCESSORY_SCHEMAS = {
  eyepiece: eyepieceSpecSchema,
  camera: cameraSpecSchema,
  barlow: barlowSpecSchema,
  filter: filterSpecSchema,
  mount: mountSpecSchema,
} as const;

/** Specification fields for one accessory kind. `onPatch` receives changed fields. */
export function AccessorySpecFields({
  kind,
  spec,
  onPatch,
}: {
  kind: AccessoryKind;
  spec: AccessorySpecPair["spec"];
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const patch = onPatch;
  const r = ACCESSORY_SCHEMAS[kind].safeParse(spec);
  const nameId = useId();
  const err: Record<string, string> = {};
  if (!r.success) for (const i of r.error.issues) err[String(i.path[0])] ??= friendlyMessage(i.message);
  const num = (key: string, label: string, unit?: string, step = 1) => (
    <NumberField
      label={label}
      unit={unit}
      step={step}
      value={(spec as unknown as Record<string, number | undefined>)[key]}
      error={err[key]}
      onChange={(v) => patch({ [key]: v })}
    />
  );
  const barrel = (
    <SelectField<"1.25" | "2">
      label="Barrel size"
      value={String((spec as { barrelIn?: number }).barrelIn ?? 1.25) as "1.25" | "2"}
      options={[
        { value: "1.25", label: "1.25″" },
        { value: "2", label: "2″" },
      ]}
      onChange={(v) => patch({ barrelIn: Number(v) })}
    />
  );

  switch (kind) {
    case "eyepiece":
      return (
        <div className="grid grid-cols-2 gap-3">
          {num("focalLengthMm", "Focal length", "mm", 0.5)}
          {num("apparentFovDeg", "Apparent field", "°")}
          {num("eyeReliefMm", "Eye relief", "mm")}
          {num("fieldStopMm", "Field stop", "mm", 0.1)}
          {barrel}
        </div>
      );
    case "camera":
      return (
        <div className="grid grid-cols-2 gap-3">
          {num("sensorWidthMm", "Sensor width", "mm", 0.01)}
          {num("sensorHeightMm", "Sensor height", "mm", 0.01)}
          {num("pixelSizeUm", "Pixel size", "µm", 0.01)}
          <SelectField<"color" | "mono">
            label="Sensor type"
            value={(spec as { color?: boolean }).color === false ? "mono" : "color"}
            options={[
              { value: "color", label: "Colour" },
              { value: "mono", label: "Monochrome" },
            ]}
            onChange={(v) => patch({ color: v === "color" })}
          />
        </div>
      );
    case "barlow":
      return (
        <div className="grid grid-cols-2 gap-3">
          {num("factor", "Factor", "×", 0.1)}
          {barrel}
        </div>
      );
    case "filter":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={nameId} className="block text-xs text-muted">
              Name
            </label>
            <input
              id={nameId}
              value={(spec as { name: string }).name}
              maxLength={100}
              onChange={(e) => patch({ name: e.target.value })}
              aria-invalid={Boolean(err.name)}
              className={inputClass}
            />
          </div>
          <SelectField<FilterKind>
            label="Type"
            value={(spec as { kind?: FilterKind }).kind ?? "other"}
            options={FILTER_KINDS.map((k) => ({ value: k, label: FILTER_KIND_LABELS[k] }))}
            onChange={(v) => patch({ kind: v })}
          />
        </div>
      );
    case "mount": {
      const m = spec as MountSpec;
      return (
        <div className="space-y-3">
          <SelectField<MountType> label="Type" value={m.type} options={MOUNT_TYPES} onChange={(type) => patch({ type })} />
          {num("payloadKg", "Rated payload", "kg", 0.5)}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(m.goto)} onChange={(e) => patch({ goto: e.target.checked })} className="accent-accent" />
            GoTo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(m.tracking)} onChange={(e) => patch({ tracking: e.target.checked })} className="accent-accent" />
            Motorised tracking
          </label>
        </div>
      );
    }
  }
}

