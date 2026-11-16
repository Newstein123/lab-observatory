"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState } from "react";
import { Icons } from "@/components/ui/icons";
import type { StageProps } from "./stage";
import type { StageItem } from "./types";

export type { StageItem } from "./types";
export { rigItem, type FittedParts } from "./types";
export type { PartId } from "./parts";
export type { MountPose } from "./mount-model";

/**
 * 3D equipment viewer. three.js loads only when a viewer is on screen; if
 * WebGL is unavailable or rendering fails, a static description is shown.
 */
const Stage = dynamic(() => import("./stage"), {
  ssr: false,
  loading: () => <StageLoading />,
});

function StageLoading() {
  return (
    <div role="status" aria-label="Loading 3D view" className="flex h-full w-full items-center justify-center">
      <div className="size-10 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
    </div>
  );
}

let webglSupport: boolean | undefined;

/** Probed once per session. */
function webglAvailable(): boolean {
  webglSupport ??= probeWebgl();
  return webglSupport;
}

function probeWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    // Release the probe context straight away; browsers cap live contexts.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

class StageErrorBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const ICONS: Record<StageItem["kind"], (p: { className?: string }) => React.ReactNode> = {
  telescope: Icons.Telescope,
  rig: Icons.Telescope,
  mount: Icons.Mount,
  eyepiece: Icons.Eyepiece,
  camera: Icons.Camera,
  barlow: Icons.Barlow,
  filter: Icons.Filter,
};

export function StaticEquipment({ item, label }: { item: StageItem; label: string }) {
  const Icon = ICONS[item.kind];
  return (
    <div role="img" aria-label={label} className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-20 items-center justify-center rounded-full border border-border-strong bg-surface-raised/60 text-accent">
        <Icon className="size-10" />
      </div>
      <p className="max-w-[16rem] text-xs text-muted">3D preview unavailable in this browser. Specifications are shown alongside.</p>
    </div>
  );
}

export function EquipmentViewer(props: StageProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  // Start WebGL (loading three.js and compiling shaders blocks the main
  // thread for a moment) only once the page has painted and gone idle, so
  // the page itself appears and responds to clicks first.
  useEffect(() => {
    const start = () => setSupported(webglAvailable());
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(start, 200);
    return () => window.clearTimeout(id);
  }, []);
  const fallback = <StaticEquipment item={props.item} label={props.label} />;
  return (
    <div className={props.className}>
      {supported === null ? (
        <StageLoading />
      ) : supported ? (
        <StageErrorBoundary fallback={fallback} resetKey={props.label}>
          <Stage {...props} className="h-full w-full" />
        </StageErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
