"use client";

import { useId, useState } from "react";
import { AccessorySpecFields } from "@/components/equipment/accessory-spec-fields";
import { Button } from "@/components/ui/button";
import { inputClass, NumberField, SelectField } from "@/components/ui/fields";
import { friendlyMessage } from "@/lib/validation-messages";
import { CATALOGS, TELESCOPE_CATALOG, displayName, type AccessoryCatalogEntry } from "@/modules/equipment/catalog";
import {
  ACCESSORY_KINDS,
  accessoryInputSchema,
  EQUIPMENT_STATUSES,
  MOUNT_TYPES,
  OPTICAL_DESIGNS,
  telescopeProfileInputSchema,
  type AccessoryInput,
  type AccessoryKind,
  type AccessorySpecPair,
  type EquipmentStatus,
  type MountType,
  type TelescopeProfileInput,
} from "@/modules/equipment/models";
import type { OpticalDesign } from "@/modules/simulations/engine";

type Errors = Record<string, string>;

function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const out: Errors = {};
  for (const i of issues) out[i.path.map(String).join(".")] ??= friendlyMessage(i.message);
  return out;
}

function TextField({ label, value, onChange, error, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; multiline?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} value={value} maxLength={2000} rows={2} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputClass} h-auto py-2`} />
      ) : (
        <input id={id} value={value} maxLength={100} placeholder={placeholder} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

const optional = (v?: string) => (v && v.trim() ? v.trim() : undefined);

interface FormProps<T> {
  initial?: T;
  submitLabel: string;
  onSubmit: (input: T) => Promise<void>;
  onCancel: () => void;
}

const EMPTY_TELESCOPE: Partial<TelescopeProfileInput> = { name: "", status: "owned", opticalDesign: "reflector", mountType: "dobsonian" };

export function TelescopeForm({ initial, submitLabel, onSubmit, onCancel }: FormProps<TelescopeProfileInput>) {
  const [draft, setDraft] = useState<Partial<TelescopeProfileInput>>(initial ?? EMPTY_TELESCOPE);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<TelescopeProfileInput>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = telescopeProfileInputSchema.safeParse({
      ...draft,
      manufacturer: optional(draft.manufacturer),
      model: optional(draft.model),
      notes: optional(draft.notes),
    });
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    setSubmitError(undefined);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {!initial && (
        <SelectField
          label="Fill from catalogue (optional)"
          value=""
          placeholder="Choose a model…"
          options={TELESCOPE_CATALOG.map((t) => ({ value: t.id, label: displayName(t) }))}
          onChange={(id) => {
            const t = TELESCOPE_CATALOG.find((x) => x.id === id);
            if (t)
              set({
                name: draft.name || t.model,
                manufacturer: t.manufacturer,
                model: t.model,
                opticalDesign: t.optics.opticalDesign,
                apertureMm: t.optics.apertureMm,
                focalLengthMm: t.optics.focalLengthMm,
                mountType: t.mountType,
              });
          }}
        />
      )}
      <TextField label="Name" value={draft.name ?? ""} onChange={(name) => set({ name })} error={errors.name} placeholder="e.g. My 200 mm Newtonian" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <SelectField<EquipmentStatus> label="Status" value={draft.status ?? "owned"} options={EQUIPMENT_STATUSES} onChange={(status) => set({ status })} />
        <SelectField<OpticalDesign> label="Optical design" value={draft.opticalDesign ?? ""} options={OPTICAL_DESIGNS} onChange={(opticalDesign) => set({ opticalDesign })} />
        <NumberField label="Aperture" unit="mm" value={draft.apertureMm} error={errors.apertureMm} onChange={(v) => set({ apertureMm: v })} />
        <NumberField label="Focal length" unit="mm" value={draft.focalLengthMm} error={errors.focalLengthMm} onChange={(v) => set({ focalLengthMm: v })} />
        <SelectField<MountType> label="Mount" value={draft.mountType ?? ""} options={MOUNT_TYPES} onChange={(mountType) => set({ mountType })} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <TextField label="Manufacturer (optional)" value={draft.manufacturer ?? ""} onChange={(manufacturer) => set({ manufacturer })} />
        <TextField label="Model (optional)" value={draft.model ?? ""} onChange={(model) => set({ model })} />
      </div>
      <TextField label="Notes (optional)" value={draft.notes ?? ""} onChange={(notes) => set({ notes })} multiline />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

const BLANK_SPECS: { [K in AccessoryKind]: Extract<AccessorySpecPair, { kind: K }>["spec"] } = {
  eyepiece: { focalLengthMm: 25, apparentFovDeg: 52, barrelIn: 1.25 },
  camera: { sensorWidthMm: 11.3, sensorHeightMm: 11.3, pixelSizeUm: 3.76, color: true },
  barlow: { factor: 2, barrelIn: 1.25 },
  filter: { name: "UHC", kind: "uhc" },
  mount: { type: "equatorial", payloadKg: 9, goto: false, tracking: false },
};

export function AccessoryForm({ initial, submitLabel, onSubmit, onCancel, defaultKind = "eyepiece" }: FormProps<AccessoryInput> & { defaultKind?: AccessoryKind }) {
  const [draft, setDraft] = useState<AccessoryInput>(
    initial ?? ({ kind: defaultKind, name: "", status: "owned", spec: BLANK_SPECS[defaultKind] } as AccessoryInput),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<AccessoryInput>) => setDraft((d) => ({ ...d, ...patch }) as AccessoryInput);
  const entries = CATALOGS[draft.kind] as AccessoryCatalogEntry<AccessorySpecPair["spec"]>[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = accessoryInputSchema.safeParse({
      ...draft,
      manufacturer: optional(draft.manufacturer),
      model: optional(draft.model),
      notes: optional(draft.notes),
    });
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    setSubmitError(undefined);
    try {
      await onSubmit(parsed.data as AccessoryInput);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {!initial && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <SelectField<AccessoryKind>
            label="Type"
            value={draft.kind}
            options={ACCESSORY_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            onChange={(kind) => setDraft((d) => ({ ...d, kind, spec: BLANK_SPECS[kind] }) as AccessoryInput)}
          />
          <SelectField
            label="Fill from catalogue (optional)"
            value=""
            placeholder="Choose a model…"
            options={entries.map((e) => ({ value: e.id, label: displayName(e) }))}
            onChange={(id) => {
              const e = entries.find((x) => x.id === id);
              if (e) set({ spec: structuredClone(e.spec), name: draft.name || e.model, manufacturer: e.manufacturer, model: e.model } as Partial<AccessoryInput>);
            }}
          />
        </div>
      )}
      <TextField label="Name" value={draft.name} onChange={(name) => set({ name })} error={errors.name} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <SelectField<EquipmentStatus> label="Status" value={draft.status} options={EQUIPMENT_STATUSES} onChange={(status) => set({ status })} />
        <TextField label="Manufacturer" value={draft.manufacturer ?? ""} onChange={(manufacturer) => set({ manufacturer })} />
        <TextField label="Model" value={draft.model ?? ""} onChange={(model) => set({ model })} />
      </div>
      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-xs text-muted">Specifications</legend>
        <AccessorySpecFields kind={draft.kind} spec={draft.spec} onPatch={(p) => set({ spec: { ...draft.spec, ...p } } as Partial<AccessoryInput>)} />
      </fieldset>
      <TextField label="Notes (optional)" value={draft.notes ?? ""} onChange={(notes) => set({ notes })} multiline />
      {Object.keys(errors).some((k) => k.startsWith("spec")) && <p className="text-sm text-danger">Check the specification values.</p>}
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
