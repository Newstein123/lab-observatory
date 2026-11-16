"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { describeAccessory } from "@/modules/equipment/models";
import { arPath, decodeArParams } from "@/modules/lab/ar-link";
import { ArQrCode, ArViewer } from "./ar-button";

const InteractiveAr = dynamic(() => import("./interactive-ar"), {
  ssr: false,
  loading: () => <p className="text-center text-xs text-muted">Loading hands-on AR…</p>,
});

/**
 * Hands-on AR needs WebXR "immersive-ar" (Chrome on ARCore Android phones,
 * headsets). On localhost a desktop emulator stands in, for development.
 */
function useHandsOnAr(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
    // On localhost the XR library injects an emulator when the browser has no AR.
    if (local) setOk(true);
    else
      xr?.isSessionSupported("immersive-ar")
        .then((v) => !cancelled && setOk(v))
        .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return ok;
}

/** Full-screen AR view of a setup carried in the link (from the AR button or a QR code). */
export function ArPage({ params }: { params: Record<string, string | string[] | undefined> }) {
  const setup = decodeArParams(params);
  const [canAR, setCanAR] = useState<boolean>();
  const handsOn = useHandsOnAr();

  if (!setup) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          title="This AR link doesn't describe a telescope"
          action={
            <Link href="/lab" className={buttonStyles({ variant: "primary", size: "sm" })}>
              Open the Telescope Lab
            </Link>
          }
        >
          It may have been cut short when it was copied. Open AR again from the Lab.
        </EmptyState>
      </main>
    );
  }

  const t = setup.telescope;
  const inFocuser = setup.mode === "visual" ? setup.eyepiece : setup.camera;
  return (
    <main className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-3xl flex-col gap-3 px-4 py-4 md:h-[calc(100dvh-4rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Telescope in AR</p>
          <h1 className="truncate text-lg font-semibold">{setup.name ?? t.label ?? "Telescope"}</h1>
          <p className="truncate text-xs text-muted">
            {t.label ? `${t.label} · ` : ""}
            {t.apertureMm} mm f/{(t.focalLengthMm / t.apertureMm).toFixed(1)}
            {setup.mount?.label ? ` · ${setup.mount.label}` : ""}
            {inFocuser
              ? ` · ${inFocuser.label ?? describeAccessory(setup.mode === "visual" ? { kind: "eyepiece", spec: setup.eyepiece! } : { kind: "camera", spec: setup.camera! })}`
              : ""}
          </p>
        </div>
        <Link href="/lab/simulate" className={buttonStyles({ size: "sm" })}>
          Lab
        </Link>
      </div>
      <ArViewer setup={setup} className="min-h-0 flex-1" onAvailability={setCanAR} />
      {handsOn && <InteractiveAr setup={setup} />}
      {canAR === false && !handsOn && (
        <div className="rounded-xl border border-border bg-surface-sunken/50 p-3">
          <p className="text-sm font-medium">AR isn&apos;t available in this browser</p>
          <p className="mt-1 text-xs text-muted">
            Use an iPhone or iPad (Safari), or an ARCore Android phone in Chrome. You can still turn the model here.
          </p>
          <div className="mt-3 hidden sm:block">
            <ArQrCode path={arPath(setup)} />
          </div>
        </div>
      )}
    </main>
  );
}
