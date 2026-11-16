"use client";

import { useMemo } from "react";
import { SimulationViewport, type ViewSettings } from "@/components/lab/simulation-viewport";
import type { SimulationSession } from "@/modules/sessions/models";

/** Small rendering of a saved session's view, from its stored result. */
export function SessionThumbnail({ session, size = 72 }: { session: SimulationSession; size?: number }) {
  const settings: ViewSettings = useMemo(
    () => ({
      focusOffset: session.view.focusOffset,
      longExposureColor: session.view.longExposureColor,
      zoom: session.view.zoom,
      // Sessions saved before the time was recorded: the moment they were saved.
      observedAt: session.view.observedAt ?? session.createdAt,
      gain: session.exposure?.gain ?? 1,
      exposureS: session.exposure?.exposureS ?? 0,
      filterKind: session.configurationSnapshot.filter?.kind,
    }),
    [session],
  );
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black" style={{ width: size, height: size }}>
      <div style={{ width: size }}>
        <SimulationViewport result={session.result} target={session.targetSnapshot} settings={settings} stale={false} maxSizePx={size} compact />
      </div>
    </div>
  );
}
