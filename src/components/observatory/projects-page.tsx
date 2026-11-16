"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { friendlyMessage } from "@/lib/validation-messages";
import { summarizeConfiguration } from "@/modules/configurations/models";
import { getRepository, useRepositoryQuery } from "@/modules/persistence/client";
import {
  observationProjectInputSchema,
  PROJECT_SUGGESTIONS,
  type ObservationProject,
  type ObservationProjectInput,
} from "@/modules/projects/models";
import type { SimulationSession } from "@/modules/sessions/models";
import { getTarget, TARGET_GROUPS, TARGETS } from "@/modules/targets/catalogue";
import { useMutation } from "./mutations";
import { PageHeader } from "./observatory-shell";
import { SessionThumbnail } from "./session-thumbnail";

function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ObservationProjectInput;
  submitLabel: string;
  onSubmit: (input: ObservationProjectInput) => Promise<void>;
  onCancel: () => void;
}) {
  const nameId = useId();
  const descId = useId();
  const [draft, setDraft] = useState<ObservationProjectInput>(initial ?? { name: "", description: "", targetIds: [] });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = observationProjectInputSchema.safeParse({ ...draft, description: draft.description?.trim() || undefined });
        if (!parsed.success) return setError(friendlyMessage(parsed.error.issues[0].message));
        setBusy(true);
        setError(undefined);
        try {
          await onSubmit(parsed.data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1">
        <label htmlFor={nameId} className="block text-xs text-muted">
          Name
        </label>
        <input id={nameId} value={draft.name} maxLength={100} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="e.g. Solar System Observation" />
      </div>
      <div className="space-y-1">
        <label htmlFor={descId} className="block text-xs text-muted">
          Description (optional)
        </label>
        <textarea id={descId} rows={2} maxLength={2000} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`${inputClass} h-auto py-2`} />
      </div>
      <fieldset>
        <legend className="mb-2 text-xs text-muted">Targets</legend>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {TARGET_GROUPS.map((g) => (
            <div key={g.category}>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-subtle">{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {TARGETS.filter((t) => g.categories.includes(t.category)).map((t) => {
                  const on = draft.targetIds.includes(t.id);
                  return (
                    <label key={t.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${on ? "border-accent bg-accent/15" : "border-border text-muted"}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => setDraft({ ...draft, targetIds: on ? draft.targetIds.filter((x) => x !== t.id) : [...draft.targetIds, t.id] })}
                      />
                      {t.designation ?? t.name}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/** Targets with at least one saved simulation in the project. */
function coverage(project: ObservationProject, sessions: SimulationSession[]) {
  const inProject = sessions.filter((s) => project.sessionIds.includes(s.id));
  const covered = project.targetIds.filter((t) => inProject.some((s) => s.targetSnapshot.id === t));
  return { inProject, covered };
}

export function ProjectsPage() {
  const router = useRouter();
  const q = useRepositoryQuery(async (r) => ({ projects: await r.listProjects(), sessions: await r.listSessions() }), []);
  const [creating, setCreating] = useState(false);
  const { run } = useMutation();

  const create = async (input: ObservationProjectInput) => {
    const p = await getRepository().createProject(input);
    setCreating(false);
    router.push(`/observatory/projects/${p.id}`);
  };

  return (
    <div>
      <PageHeader
        title="Observation projects"
        description="Group targets and saved simulations around a goal, such as a planetary season or a telescope test."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icons.Plus className="size-4" /> New project
          </Button>
        }
      />
      {q.status === "loading" && <LoadingList />}
      {q.status === "error" && <ErrorState message={q.error.message} />}
      {q.status === "ready" && (
        <div className="space-y-6">
          {q.data.projects.length === 0 ? (
            <EmptyState title="No projects yet" icon={<Icons.Folder />}>
              Start from a suggestion below, or create your own.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {q.data.projects.map((p) => {
                const { inProject, covered } = coverage(p, q.data.sessions);
                const pct = p.targetIds.length ? Math.round((covered.length / p.targetIds.length) * 100) : 0;
                return (
                  <li key={p.id}>
                    <Link href={`/observatory/projects/${p.id}`} className="glass block h-full rounded-xl p-4 transition-colors hover:border-border-strong">
                      <div className="flex items-center gap-2">
                        <Icons.Folder className="size-4 text-accent" />
                        <h2 className="truncate font-medium">{p.name}</h2>
                      </div>
                      {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.targetIds.map((t) => (
                          <span key={t} className={`rounded-full border px-2 py-0.5 text-xs ${covered.includes(t) ? "border-success/40 text-success" : "border-border text-muted"}`}>
                            {getTarget(t)?.name ?? t}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted">
                        {inProject.length} {inProject.length === 1 ? "simulation" : "simulations"}
                        {p.targetIds.length > 0 && ` · ${covered.length} of ${p.targetIds.length} targets simulated`}
                      </p>
                      {p.targetIds.length > 0 && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Targets simulated">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <section aria-label="Suggestions">
            <h2 className="mb-3 text-sm font-semibold text-muted">Suggestions</h2>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
              {PROJECT_SUGGESTIONS.filter((s) => !q.data.projects.some((p) => p.name === s.name)).map((s) => (
                <li key={s.name} className="rounded-xl border border-dashed border-border-strong/70 p-4">
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                  <Button size="sm" className="mt-3" onClick={() => run(() => create(s), "Project created.")}>
                    Create
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="New project">
        {creating && <ProjectForm submitLabel="Create project" onCancel={() => setCreating(false)} onSubmit={create} />}
      </Dialog>
    </div>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const q = useRepositoryQuery(async (r) => ({ project: await r.getProject(id), sessions: await r.listSessions() }), [id]);
  const [editing, setEditing] = useState(false);
  const { run, busy } = useMutation();

  if (q.status === "loading") return <LoadingList />;
  if (q.status === "error") return <ErrorState message={q.error.message} />;
  const project = q.data.project;
  if (!project)
    return (
      <EmptyState title="This project does not exist or was deleted" action={<Link href="/observatory/projects" className={buttonStyles({ size: "sm" })}>All projects</Link>} />
    );

  const { inProject } = coverage(project, q.data.sessions);
  const ordered = project.sessionIds.map((sid) => inProject.find((s) => s.id === sid)).filter((s): s is SimulationSession => Boolean(s));
  const addable = q.data.sessions.filter((s) => !project.sessionIds.includes(s.id));

  return (
    <div className="space-y-5">
      <Link href="/observatory/projects" className="text-sm text-muted hover:text-foreground">
        ← Projects
      </Link>
      <PageHeader
        title={project.name}
        description={project.description}
        actions={
          <>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`Delete project “${project.name}”? Its simulations are kept.`))
                  run(async () => {
                    await getRepository().deleteProject(project.id);
                    router.push("/observatory/projects");
                  }, "Project deleted.");
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      <section className="glass rounded-xl p-4" aria-label="Targets">
        <h2 className="mb-3 font-semibold">Targets</h2>
        {project.targetIds.length === 0 ? (
          <p className="text-sm text-muted">No targets yet. Edit the project to add some.</p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {project.targetIds.map((t) => {
              const target = getTarget(t);
              const n = inProject.filter((s) => s.targetSnapshot.id === t).length;
              return (
                <li key={t} className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken/50 p-3">
                  <span className={`size-2.5 shrink-0 rounded-full ${n ? "bg-success" : "bg-border-strong"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{target?.name ?? t}</p>
                    <p className="text-xs text-muted">{n ? `${n} ${n === 1 ? "simulation" : "simulations"}` : "Not simulated yet"}</p>
                  </div>
                  <Link href={`/lab/simulate?target=${t}`} className={buttonStyles({ size: "sm" })}>
                    Simulate
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass rounded-xl p-4" aria-label="Simulations in this project">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Simulations</h2>
          {addable.length > 0 && (
            <select
              aria-label="Add a saved simulation"
              value=""
              disabled={busy}
              onChange={(e) => run(() => getRepository().addSessionToProject(project.id, e.target.value), "Simulation added.")}
              className="h-9 rounded-lg border border-border bg-surface-sunken px-2 text-sm"
            >
              <option value="" disabled>
                Add a saved simulation…
              </option>
              {addable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDateTime(s.createdAt)}
                </option>
              ))}
            </select>
          )}
        </div>
        {ordered.length === 0 ? (
          <EmptyState title="No simulations in this project">
            Save a simulation in the Lab, then add it here or from the Simulations page.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {ordered.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken/50 p-2.5">
                <SessionThumbnail session={s} size={64} />
                <div className="min-w-0 flex-1">
                  <Link href={`/observatory/simulations/${s.id}`} className="block truncate text-sm font-medium hover:text-accent">
                    {s.name}
                  </Link>
                  <p className="truncate text-xs text-muted">{summarizeConfiguration(s.configurationSnapshot)}</p>
                  <p className="text-[11px] text-subtle">{formatDateTime(s.createdAt)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => run(() => getRepository().removeSessionFromProject(project.id, s.id), "Removed from project.")}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit project">
        {editing && (
          <ProjectForm
            initial={{ name: project.name, description: project.description, targetIds: project.targetIds }}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              await getRepository().updateProject(project.id, input);
              setEditing(false);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
