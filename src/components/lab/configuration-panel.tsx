"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { EquipmentViewer, rigItem } from "@/components/equipment-3d";
import { inputClass, NumberField, Panel, SelectField } from "@/components/ui/fields";
import { CONFIGURATION_STATUSES, type ConfigurationSpec, type ConfigurationStatus } from "@/modules/configurations/models";
import { CATALOGS, TELESCOPE_CATALOG, getTelescopeEntry } from "@/modules/equipment/catalog";
import {
  ACCESSORY_KINDS,
  describeAccessory,
  OPTICAL_DESIGNS,
  type Accessory,
  type AccessoryKind,
  type AccessorySpecPair,
  type TelescopeProfile,
} from "@/modules/equipment/models";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import { telescopeOpticsSchema, type OpticalDesign, type TelescopeOptics } from "@/modules/simulations/engine";
import type { TrainMode } from "@/modules/lab/workbench";
import { ArButton } from "@/components/ar/ar-button";
import { ExpandButton, TelescopeWorkbench } from "./telescope-workbench";
import { EquipmentPicker, type PickerOption, type PickerVisual } from "./equipment-picker";

/** Field errors keyed by engine input path, e.g. "optics.apertureMm". */
export type FieldErrors = Record<string, string>;

interface Props {
  config: ConfigurationSpec;
  onChange: (config: ConfigurationSpec) => void;
  errors: FieldErrors;
  /** Eyepiece or camera view: decides what the preview shows in the focuser. */
  mode?: TrainMode;
  onModeChange?: (m: TrainMode) => void;
  focusOffset?: number;
  onFocusOffsetChange?: (v: number) => void;
}

/**
 * Numeric fields may be temporarily empty while the user types. The engine
 * validates every value before use, so an undefined here becomes a field
 * error rather than a bad calculation.
 */
const num = (v: number | undefined) => v as number;

/** "catalog:abc" → ["catalog", "abc"] (ids may themselves contain colons). */
const splitId = (id: string): [string, string] => {
  const i = id.indexOf(":");
  return [id.slice(0, i), id.slice(i + 1)];
};

const opticsDetail = (o: Partial<TelescopeOptics>) =>
  o.apertureMm && o.focalLengthMm
    ? `${o.apertureMm} mm · f/${(o.focalLengthMm / o.apertureMm).toFixed(1)}${o.opticalDesign ? ` · ${OPTICAL_DESIGNS.find((d) => d.value === o.opticalDesign)?.label ?? ""}` : ""}`
    : "Enter aperture and focal length";

/** Remove the identifying label once a value is edited by hand. */
function unlabel<T extends { label?: string }>(spec: T | undefined): T {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { label, ...rest } = (spec ?? {}) as T;
  return rest as T;
}

const opticsOf = (p: TelescopeProfile) => ({
  apertureMm: p.apertureMm,
  focalLengthMm: p.focalLengthMm,
  opticalDesign: p.opticalDesign,
});

export function ConfigurationPanel({ config, onChange, errors, mode = "visual", onModeChange, focusOffset, onFocusOffsetChange }: Props) {
  const nameId = useId();
  const set = (patch: Partial<ConfigurationSpec>) => onChange({ ...config, ...patch });
  /** Hand-edited optics are no longer the catalogue model. */
  const setOptics = (patch: Partial<ConfigurationSpec["telescope"]>) =>
    onChange({ ...config, catalogRef: undefined, telescope: { ...unlabel(config.telescope), ...patch } });
  const profilesQuery = useOwnerQuery((r) => r.listProfiles(), []);
  const profiles = profilesQuery.data ?? [];
  const linked = config.profileId ? profiles.find((p) => p.id === config.profileId) : undefined;
  const isLinked = Boolean(config.profileId);
  const catalogEntry = linked ? undefined : getTelescopeEntry(config.catalogRef);
  const owned = useOwnerQuery((r) => r.listAccessories(), []).data ?? [];

  return (
    <Panel
      title="Configuration"
      actions={
        <Link href="/lab/configure" className="text-xs text-accent hover:underline">
          Equipment in 3D →
        </Link>
      }
    >
      <div className="space-y-5">
        <SetupPreview
          config={config}
          onChange={onChange}
          mode={mode}
          onModeChange={onModeChange}
          focusOffset={focusOffset}
          onFocusOffsetChange={onFocusOffsetChange}
        />
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={nameId} className="block text-xs text-muted">
              Name
            </label>
            <input
              id={nameId}
              value={config.name}
              maxLength={100}
              onChange={(e) => set({ name: e.target.value })}
              className={inputClass}
            />
          </div>
          <SelectField<ConfigurationStatus>
            label="Status"
            value={config.status}
            options={CONFIGURATION_STATUSES}
            onChange={(status) => set({ status })}
          />
        </div>

        <Section title="Telescope">
          <EquipmentPicker
            label="Telescope"
            current={{
              eyebrow: linked ? "My equipment" : catalogEntry?.manufacturer ?? (config.telescope.label ? undefined : "Custom"),
              title: linked?.name ?? (catalogEntry ? catalogEntry.model : config.telescope.label ?? "Custom telescope"),
              detail: opticsDetail(config.telescope),
              visual: { type: "telescope", optics: config.telescope },
            }}
            selectedId={config.profileId ? `profile:${config.profileId}` : config.catalogRef ? `catalog:${config.catalogRef}` : undefined}
            options={[
              ...profiles.map<PickerOption>((p) => ({
                id: `profile:${p.id}`,
                group: "My equipment",
                eyebrow: p.manufacturer,
                title: p.name,
                detail: opticsDetail(opticsOf(p)),
                visual: { type: "telescope", optics: opticsOf(p) },
              })),
              ...[...TELESCOPE_CATALOG].sort((a, b) => a.manufacturer.localeCompare(b.manufacturer)).map<PickerOption>((t) => ({
                id: `catalog:${t.id}`,
                group: t.manufacturer,
                eyebrow: t.manufacturer,
                title: t.model,
                detail: opticsDetail(t.optics),
                visual: { type: "telescope", optics: t.optics },
              })),
            ]}
            onPick={(id) => {
              const [source, ref] = splitId(id);
              if (source === "profile") {
                const p = profiles.find((x) => x.id === ref);
                if (p) set({ profileId: p.id, catalogRef: undefined, telescope: opticsOf(p) });
              } else {
                const t = TELESCOPE_CATALOG.find((x) => x.id === ref);
                if (t) set({ profileId: undefined, catalogRef: t.id, telescope: { ...t.optics } });
              }
            }}
            footer={
              <>
                Or enter your own aperture and focal length below.{" "}
                <Link href="/observatory/equipment" className="text-accent hover:underline">
                  Add a telescope you own
                </Link>{" "}
                to reuse it.
              </>
            }
          />
          {isLinked && (
            <p className="text-xs text-muted">
              {linked ? "Optics come from your equipment." : "The linked telescope was deleted."}{" "}
              <button type="button" className="text-accent hover:underline" onClick={() => set({ profileId: undefined })}>
                Unlink to edit
              </button>
            </p>
          )}
          <SelectField<OpticalDesign>
            label="Optical design"
            value={config.telescope.opticalDesign ?? ""}
            placeholder="Select…"
            options={OPTICAL_DESIGNS}
            disabled={isLinked}
            onChange={(opticalDesign) => setOptics({ opticalDesign })}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Aperture"
              unit="mm"
              value={config.telescope.apertureMm}
              disabled={isLinked}
              error={errors["optics.apertureMm"]}
              onChange={(v) => setOptics({ apertureMm: num(v) })}
            />
            <NumberField
              label="Focal length"
              unit="mm"
              value={config.telescope.focalLengthMm}
              disabled={isLinked}
              error={errors["optics.focalLengthMm"]}
              onChange={(v) => setOptics({ focalLengthMm: num(v) })}
            />
          </div>
          <AccessoryPicker kind="mount" config={config} owned={owned} set={set} />
        </Section>

        <Section title="Eyepiece">
          <AccessoryPicker kind="eyepiece" config={config} owned={owned} set={set} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Focal length"
              unit="mm"
              step={0.5}
              value={config.eyepiece?.focalLengthMm}
              error={errors["eyepiece.focalLengthMm"]}
              onChange={(v) => set({ eyepiece: { ...unlabel(config.eyepiece), focalLengthMm: num(v) } })}
            />
            <NumberField
              label="Apparent field"
              unit="°"
              value={config.eyepiece?.apparentFovDeg}
              error={errors["eyepiece.apparentFovDeg"]}
              onChange={(v) => set({ eyepiece: { ...unlabel(config.eyepiece), apparentFovDeg: num(v) } })}
            />
          </div>
          <NumberField
            label="Field stop (optional)"
            unit="mm"
            step={0.1}
            value={config.eyepiece?.fieldStopMm}
            error={errors["eyepiece.fieldStopMm"]}
            hint="If known, gives a more accurate true field."
            onChange={(v) => set({ eyepiece: { ...unlabel(config.eyepiece), fieldStopMm: v } })}
          />
        </Section>

        <Section title="Camera">
          <AccessoryPicker kind="camera" config={config} owned={owned} set={set} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Sensor width"
              unit="mm"
              step={0.01}
              value={config.camera?.sensorWidthMm}
              error={errors["camera.sensorWidthMm"]}
              onChange={(v) => set({ camera: { ...unlabel(config.camera), sensorWidthMm: num(v) } })}
            />
            <NumberField
              label="Sensor height"
              unit="mm"
              step={0.01}
              value={config.camera?.sensorHeightMm}
              error={errors["camera.sensorHeightMm"]}
              onChange={(v) => set({ camera: { ...unlabel(config.camera), sensorHeightMm: num(v) } })}
            />
          </div>
          <NumberField
            label="Pixel size"
            unit="µm"
            step={0.01}
            value={config.camera?.pixelSizeUm}
            error={errors["camera.pixelSizeUm"]}
            onChange={(v) => set({ camera: { ...unlabel(config.camera), pixelSizeUm: num(v) } })}
          />
        </Section>

        <Section title="Accessories">
          <AccessoryPicker kind="barlow" config={config} owned={owned} set={set} />
          {config.barlow && (
            <NumberField
              label="Barlow factor"
              unit="×"
              step={0.5}
              value={config.barlow.factor}
              error={errors["barlow.factor"]}
              onChange={(v) => set({ barlow: { ...unlabel(config.barlow), factor: num(v) } })}
            />
          )}
          <AccessoryPicker kind="filter" config={config} owned={owned} set={set} />
          <p className="text-xs text-muted">Filters dim and tint the view using a typical transmission (estimated).</p>
        </Section>
      </div>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3 border-t border-border pt-4">
      <legend className="pr-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}


/**
 * Live 3D model of the whole setup: the eyepiece (or camera) and accessories
 * sit in the focuser. Still until dragged, so it costs nothing while
 * simulating. The expand button opens the hands-on workbench.
 */
function SetupPreview({
  config,
  onChange,
  mode,
  onModeChange,
  focusOffset,
  onFocusOffsetChange,
}: {
  config: ConfigurationSpec;
  onChange: (c: ConfigurationSpec) => void;
  mode: TrainMode;
  onModeChange?: (m: TrainMode) => void;
  focusOffset?: number;
  onFocusOffsetChange?: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = config.telescope;
  const valid = telescopeOpticsSchema.safeParse(t).success;
  return (
    <div className="relative -mx-1 overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_50%_80%,rgba(81,98,255,0.18),transparent_65%)]">
      {valid ? (
        <EquipmentViewer
          item={rigItem(config, { mode })}
          controls={false}
          autoRotate={false}
          label={`3D model of ${t.label ?? `a ${t.apertureMm} mm telescope`}${config.mount?.label ? ` on ${config.mount.label}` : ""}, with the ${mode === "visual" ? "eyepiece" : "camera"} fitted`}
          className="h-[210px]"
        />
      ) : (
        <div className="flex h-[210px] items-center justify-center p-4 text-center text-xs text-muted">
          Enter a valid aperture and focal length to see the telescope.
        </div>
      )}
      {valid && (
        <div className="absolute top-2 right-2 flex gap-1.5">
          <ArButton spec={config} mode={mode} />
          <ExpandButton onClick={() => setOpen(true)} />
        </div>
      )}
      <TelescopeWorkbench
        open={open}
        onClose={() => setOpen(false)}
        config={config}
        onConfigChange={onChange}
        mode={mode}
        onModeChange={onModeChange}
        focusOffset={focusOffset}
        onFocusOffsetChange={onFocusOffsetChange}
      />
    </div>
  );
}

type Kind = AccessoryKind;
type AnySpec = AccessorySpecPair["spec"];

const CURRENT_TITLE: Record<Kind, string> = {
  eyepiece: "Custom eyepiece",
  camera: "Custom camera",
  barlow: "Custom Barlow",
  filter: "Custom filter",
  mount: "Custom mount",
};

const NONE_LABEL: Partial<Record<Kind, string>> = {
  barlow: "No Barlow",
  filter: "No filter",
  mount: "Not specified",
};

function visualOf(pair: AccessorySpecPair): PickerVisual {
  switch (pair.kind) {
    case "eyepiece":
      return { type: "accessory", kind: "eyepiece", badge: `${pair.spec.focalLengthMm} mm` };
    case "barlow":
      return { type: "accessory", kind: "barlow", badge: `${pair.spec.factor}×` };
    case "filter":
      return { type: "accessory", kind: "filter", filterKind: pair.spec.kind };
    case "camera":
      return { type: "accessory", kind: "camera", badge: pair.spec.color === false ? "mono" : undefined };
    case "mount":
      return { type: "accessory", kind: "mount", badge: pair.spec.goto ? "GoTo" : undefined };
  }
}

const sameSpec = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function AccessoryPicker({
  kind,
  config,
  owned,
  set,
}: {
  kind: Kind;
  config: ConfigurationSpec;
  owned: Accessory[];
  set: (patch: Partial<ConfigurationSpec>) => void;
}) {
  const label = ACCESSORY_KINDS.find((k) => k.value === kind)!.label;
  const spec = config[kind] as AnySpec | undefined;
  const catalog = CATALOGS[kind] as { id: string; manufacturer?: string; model: string; spec: AnySpec }[];
  const mine = owned.filter((a) => a.kind === kind);
  const pair = (s: AnySpec) => ({ kind, spec: s }) as AccessorySpecPair;

  const options: PickerOption[] = [
    ...mine.map((a) => ({
      id: `mine:${a.id}`,
      group: "My equipment",
      eyebrow: a.manufacturer,
      title: a.name,
      detail: describeAccessory(pair(a.spec)),
      visual: visualOf(pair(a.spec)),
    })),
    ...catalog.map((e) => ({
      id: `catalog:${e.id}`,
      group: mine.length ? "Catalogue" : undefined,
      eyebrow: e.manufacturer ?? "Generic",
      title: e.model,
      detail: describeAccessory(pair(e.spec)),
      visual: visualOf(pair(e.spec)),
    })),
  ];
  const matchMine = spec && mine.find((a) => sameSpec(a.spec, spec));
  const matchCatalog = spec && catalog.find((e) => sameSpec(e.spec, spec));
  const selectedId = matchMine ? `mine:${matchMine.id}` : matchCatalog ? `catalog:${matchCatalog.id}` : undefined;
  const specLabel = (spec as { label?: string; name?: string } | undefined)?.label ?? (spec as { name?: string } | undefined)?.name;

  return (
    <EquipmentPicker
      label={label}
      current={
        spec && {
          eyebrow: matchMine ? "My equipment" : matchCatalog ? (matchCatalog.manufacturer ?? "Generic") : undefined,
          title: matchMine?.name ?? matchCatalog?.model ?? specLabel ?? CURRENT_TITLE[kind],
          detail: describeAccessory(pair(spec)),
          visual: visualOf(pair(spec)),
        }
      }
      options={options}
      selectedId={selectedId}
      none={NONE_LABEL[kind] ? { label: NONE_LABEL[kind]!, onPick: () => set({ [kind]: undefined }) } : undefined}
      onPick={(id) => {
        const [source, ref] = splitId(id);
        const chosen = source === "mine" ? mine.find((a) => a.id === ref)?.spec : catalog.find((e) => e.id === ref)?.spec;
        if (chosen) set({ [kind]: { ...chosen } });
      }}
      footer={
        <>
          Values stay editable after you choose.{" "}
          <Link href="/observatory/equipment" className="text-accent hover:underline">
            Add {label.toLowerCase()}s you own
          </Link>
          .
        </>
      }
    />
  );
}
