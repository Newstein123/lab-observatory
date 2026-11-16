"use client";

/**
 * AR view of a telescope setup. The procedural 3D model is built off-screen,
 * exported in the browser as a glTF binary at true size (metres, standing on
 * the floor) and handed to Google's <model-viewer>, which opens the phone's
 * AR: Apple Quick Look on iPhone/iPad (it converts the model to USDZ itself)
 * and WebXR in Chrome on ARCore Android phones. Nothing is uploaded.
 *
 * Loaded only when the user asks for AR, so three.js exporters and
 * model-viewer stay out of every page's bundle.
 */

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, Group, Vector3 } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { rigItem } from "@/components/equipment-3d";
import { StageModel } from "@/components/equipment-3d/stage";
import { Button } from "@/components/ui/button";
import type { ArSetup } from "@/modules/lab/ar-link";

/** Scene units are 100 mm; glTF is in metres. */
const METRES_PER_UNIT = 0.1;

interface Built {
  url: string;
  /** Height of the setup, metres. */
  heightM: number;
}

type ModelViewerElement = HTMLElement & { canActivateAR: boolean; activateAR(): Promise<void> };

export default function ArViewer({
  setup,
  className = "",
  onAvailability,
}: {
  setup: ArSetup;
  className?: string;
  /** Reports whether this device can open AR (once known). */
  onAvailability?: (canActivateAR: boolean) => void;
}) {
  const [built, setBuilt] = useState<Built>();
  const [error, setError] = useState<string>();
  const [moduleReady, setModuleReady] = useState(false);
  const [canAR, setCanAR] = useState<boolean>();
  const [arFailed, setArFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ModelViewerElement | null>(null);
  const setupKey = JSON.stringify(setup);

  // A new setup: rebuild the model.
  const [builtFor, setBuiltFor] = useState(setupKey);
  if (builtFor !== setupKey) {
    setBuiltFor(setupKey);
    setBuilt(undefined);
    setError(undefined);
    setCanAR(undefined);
  }

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => !cancelled && setModuleReady(true))
      .catch(() => !cancelled && setError("The AR viewer could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Free the exported file when it is replaced or the viewer closes.
  useEffect(() => {
    if (!built) return;
    return () => URL.revokeObjectURL(built.url);
  }, [built]);

  useEffect(() => {
    const el = host.current;
    if (!moduleReady || !built || !el) return;
    const mv = document.createElement("model-viewer") as ModelViewerElement;
    const attrs: Record<string, string> = {
      src: built.url,
      alt: `3D model of ${setup.name ?? "the telescope"}`,
      ar: "",
      // Scene Viewer needs a public URL for the file; ours is made on the device.
      "ar-modes": "webxr quick-look",
      "ar-scale": "auto",
      "ar-placement": "floor",
      "camera-controls": "",
      "touch-action": "pan-y",
      "shadow-intensity": "1",
      "environment-image": "neutral",
      "tone-mapping": "neutral",
      exposure: "1.1",
      "interaction-prompt": "none",
      // From the side, so an equatorial mount's head and counterweight are not hidden behind the tube.
      "camera-orbit": "-65deg 75deg auto",
    };
    for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
    mv.style.width = "100%";
    mv.style.height = "100%";
    mv.style.background = "transparent";
    mv.style.setProperty("--poster-color", "transparent");
    // We draw our own AR button.
    const hiddenButton = document.createElement("span");
    hiddenButton.slot = "ar-button";
    hiddenButton.style.display = "none";
    mv.appendChild(hiddenButton);

    // AR support is settled shortly after the model loads.
    const check = () => {
      setCanAR(mv.canActivateAR);
      onAvailability?.(mv.canActivateAR);
    };
    let timer = 0;
    const onLoad = () => {
      check();
      timer = window.setTimeout(check, 900);
    };
    const onStatus = (e: Event) => {
      if ((e as CustomEvent<{ status: string }>).detail?.status === "failed") setArFailed(true);
    };
    const onError = () => setError("The 3D model could not be shown.");
    mv.addEventListener("load", onLoad);
    mv.addEventListener("ar-status", onStatus);
    mv.addEventListener("error", onError);
    el.appendChild(mv);
    viewer.current = mv;
    return () => {
      window.clearTimeout(timer);
      mv.removeEventListener("load", onLoad);
      mv.removeEventListener("ar-status", onStatus);
      mv.removeEventListener("error", onError);
      mv.remove();
      viewer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onAvailability is a notification only
  }, [moduleReady, built, setup.name]);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_50%_70%,rgba(81,98,255,0.18),transparent_65%)]">
        <div ref={host} className="h-full w-full" />
        {!built && !error && (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted">
            <div className="size-9 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
            Building your telescope in 3D…
          </div>
        )}
        {error && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-danger">
            {error}
          </p>
        )}
        {!built && !error && (
          // Off-screen scene used only to export the model.
          <div aria-hidden className="pointer-events-none absolute top-0 left-0 size-[2px] overflow-hidden opacity-0">
            <Canvas frameloop="never" dpr={1} gl={{ antialias: false }}>
              <RigExporter key={setupKey} setup={setup} onDone={setBuilt} onError={setError} />
            </Canvas>
          </div>
        )}
      </div>

      {built && canAR && (
        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              setArFailed(false);
              viewer.current?.activateAR().catch(() => setArFailed(true));
            }}
          >
            View in your space
          </Button>
          <p className="text-center text-xs text-muted">
            Point your camera at the floor, then tap to place it. It starts at true size, about {built.heightM.toFixed(1)} m tall; pinch to
            resize.
          </p>
          {arFailed && (
            <p role="alert" className="text-center text-xs text-warning">
              AR could not start. Check that the browser may use the camera, then try again.
            </p>
          )}
        </div>
      )}
      {built && canAR === false && (
        <p className="text-center text-xs text-muted">Drag to turn the model; about {built.heightM.toFixed(1)} m tall at true size.</p>
      )}
    </div>
  );
}

/** Builds the setup in an off-screen scene and exports it as a GLB file. */
function RigExporter({ setup, onDone, onError }: { setup: ArSetup; onDone: (b: Built) => void; onError: (m: string) => void }) {
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const item = useMemo(() => rigItem(setup, { mode: setup.mode }), [setup]);

  useEffect(() => {
    let cancelled = false;
    // Let textures (engraved labels) and the optical train mount first.
    const id = window.setTimeout(async () => {
      try {
        const o = outer.current;
        const i = inner.current;
        if (!o || !i) throw new Error("Scene not ready");
        o.updateMatrixWorld(true);
        const box = new Box3().setFromObject(i);
        if (box.isEmpty()) throw new Error("Empty model");
        // Stand it on the floor (y = 0), centred, in metres.
        const c = box.getCenter(new Vector3());
        i.position.set(-c.x / METRES_PER_UNIT, -box.min.y / METRES_PER_UNIT, -c.z / METRES_PER_UNIT);
        o.updateMatrixWorld(true);
        const glb = await new GLTFExporter().parseAsync(o, { binary: true, onlyVisible: true });
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([glb as ArrayBuffer], { type: "model/gltf-binary" }));
        onDone({ url, heightM: box.max.y - box.min.y });
      } catch {
        if (!cancelled) onError("The 3D model could not be prepared for AR.");
      }
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [item, onDone, onError]);

  return (
    <group ref={outer} scale={METRES_PER_UNIT}>
      <group ref={inner}>
        <StageModel item={item} />
      </group>
    </group>
  );
}
