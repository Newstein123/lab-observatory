"use client";

import { useId } from "react";
import type { ObservationProject } from "@/modules/projects/models";
import { getRepository } from "@/modules/persistence/client";
import { useMutation } from "./mutations";

/** Select that files a saved session into a project. */
export function AddToProject({ sessionId, projects }: { sessionId: string; projects: ObservationProject[] }) {
  const id = useId();
  const { run, busy } = useMutation();
  const available = projects.filter((p) => !p.sessionIds.includes(sessionId));
  const inProjects = projects.filter((p) => p.sessionIds.includes(sessionId));
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {inProjects.map((p) => (
        <span key={p.id} className="rounded-full border border-border px-2 py-0.5 text-muted">
          {p.name}
        </span>
      ))}
      {available.length > 0 && (
        <>
          <label htmlFor={id} className="sr-only">
            Add to project
          </label>
          <select
            id={id}
            value=""
            disabled={busy}
            onChange={(e) => {
              const p = projects.find((x) => x.id === e.target.value);
              if (p) run(() => getRepository().addSessionToProject(p.id, sessionId), `Added to “${p.name}”.`);
            }}
            className="h-8 rounded-lg border border-border bg-surface-sunken px-2 text-xs text-foreground"
          >
            <option value="" disabled>
              Add to project…
            </option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
