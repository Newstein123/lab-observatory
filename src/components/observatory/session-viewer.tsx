"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { SignInPrompt } from "@/components/auth/account-menu";
import { MetricsPanel } from "@/components/lab/metrics-panel";
import { SimulationViewport, type ViewSettings } from "@/components/lab/simulation-viewport";
import { TargetInfo } from "@/components/lab/target-info";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/fields";
import { Skeleton } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { canPersist, useAuth } from "@/modules/auth/use-auth";
import { useRepositoryQuery } from "@/modules/persistence/client";
import { startDraft } from "@/modules/lab/draft";
import { AddToProject } from "./add-to-project";
import { checkReproduction, type SimulationSession } from "@/modules/sessions/models";

export function SessionViewer({ id }: { id: string }) {
  const auth = useAuth();
  if (auth.mode === "supabase" && auth.status === "loading") return <Skeleton className="h-96" />;
  if (!canPersist(auth)) return <SignInPrompt>Sign in to view this saved simulation.</SignInPrompt>;
  return <SessionLoader id={id} />;
}

function SessionLoader({ id }: { id: string }) {
  const query = useRepositoryQuery(async (r) => ({ session: await r.getSession(id), projects: await r.listProjects() }), [id]);

  if (query.status === "loading") return <Skeleton className="h-96" />;
  if (query.status === "error") return <Shell>Could not load this simulation: {query.error.message}</Shell>;
  if (!query.data.session) return <Shell>This simulation does not exist or was deleted.</Shell>;
  return <SessionDetail session={query.data.session} projects={query.data.projects} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <BackLink />
      <p className="mt-6 text-sm text-muted">{children}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/observatory/simulations" className="text-sm text-muted hover:text-foreground">
      ← Simulations
    </Link>
  );
}

function SessionDetail({ session, projects }: { session: SimulationSession; projects: import("@/modules/projects/models").ObservationProject[] }) {
  const router = useRouter();
  const reproduction = useMemo(() => checkReproduction(session), [session]);
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
  const config = session.configurationSnapshot;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <BackLink />
        <header>
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {session.targetSnapshot.name} · {session.mode === "eyepiece" ? "Eyepiece view" : "Camera view"} · saved{" "}
            {formatDateTime(session.createdAt)} · engine v{session.engineVersion}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                startDraft(session.configurationSnapshot);
                router.push(`/lab/simulate?target=${session.targetSnapshot.id}&mode=${session.mode}`);
              }}
            >
              Open a copy in the Lab
            </Button>
            <AddToProject sessionId={session.id} projects={projects} />
          </div>
        </header>

        <p
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            reproduction.identical
              ? "border-prov-retrieved/40 bg-prov-retrieved/10 text-prov-retrieved"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          {reproduction.identical
            ? reproduction.savedVersion === reproduction.currentVersion
              ? "Reproducible: re-running the saved inputs with the current engine gives identical results."
              : `Saved with engine v${reproduction.savedVersion}; the current engine (v${reproduction.currentVersion}) gives identical results.`
            : `Saved with engine v${reproduction.savedVersion}. The current engine (v${reproduction.currentVersion}) gives different results; the values shown are the original saved ones.`}
        </p>

        <div className="glass rounded-2xl p-3 sm:p-5">
          <SimulationViewport result={session.result} target={session.targetSnapshot} settings={settings} stale={false} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <SnapshotPanel config={config} session={session} />
          <Panel title="Conditions">
            <dl className="space-y-1.5 text-sm">
              <Row label="Seeing">
                {session.conditions.seeingArcsec !== undefined
                  ? `${formatNumber(session.conditions.seeingArcsec, 1)}″ FWHM`
                  : "Not included"}
              </Row>
              {session.exposure && (
                <>
                  <Row label="Exposure">{session.exposure.exposureS} s</Row>
                  <Row label="Gain">{session.exposure.gain}×</Row>
                  <Row label="Tracking">{session.exposure.tracking === "none" ? "None (sky drifts)" : "Sidereal"}</Row>
                </>
              )}
              {session.mode === "eyepiece" ? (
                <Row label="Focus">{session.view.focusOffset === 0 ? "In focus" : `${Math.round(session.view.focusOffset * 100)}% off`}</Row>
              ) : (
                <Row label="Zoom">{session.view.zoom}×</Row>
              )}
            </dl>
          </Panel>
        </div>

        <TargetInfo target={session.targetSnapshot} />
      </div>

      <aside>
        <MetricsPanel result={session.result} />
      </aside>
    </div>
  );
}

function SnapshotPanel({ config, session }: { config: ConfigurationSpec; session: SimulationSession }) {
  const ref = session.configurationRef;
  return (
    <Panel title="Configuration snapshot">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium">{config.name}</span>
        <StatusChip status={config.status} />
      </div>
      <dl className="space-y-1.5 text-sm">
        <Row label="Telescope">
          {config.telescope.label ? `${config.telescope.label}, ` : ""}
          {config.telescope.apertureMm} mm, {config.telescope.focalLengthMm} mm
        </Row>
        {config.mount && <Row label="Mount">{config.mount.label ?? config.mount.type}</Row>}
        {config.eyepiece && (
          <Row label="Eyepiece">
            {config.eyepiece.focalLengthMm} mm, {config.eyepiece.apparentFovDeg}°
            {config.eyepiece.fieldStopMm !== undefined && `, field stop ${config.eyepiece.fieldStopMm} mm`}
          </Row>
        )}
        {config.camera && (
          <Row label="Camera">
            {config.camera.sensorWidthMm} × {config.camera.sensorHeightMm} mm, {config.camera.pixelSizeUm} µm
          </Row>
        )}
        {config.barlow && <Row label="Barlow">{config.barlow.factor}×</Row>}
        {config.filter && <Row label="Filter">{config.filter.name}</Row>}
        {config.camera?.label && <Row label="Camera model">{config.camera.label}</Row>}
      </dl>
      <p className="mt-3 text-xs text-muted">
        This copy was frozen when the session was saved; editing or deleting the configuration does not change it.
        {ref && (
          <>
            {" "}
            Based on{" "}
            <Link href={`/lab/simulate?config=${ref.id}`} className="text-accent hover:underline">
              saved configuration v{ref.version}
            </Link>
            {ref.modified && " with unsaved changes"}.
          </>
        )}
      </p>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
