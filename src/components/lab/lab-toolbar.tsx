"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StatusChip } from "@/components/ui/status-chip";
import { canPersist, signInHref, useAuth } from "@/modules/auth/use-auth";
import { isDraftDirty, markDraftSaved, type LabDraft } from "@/modules/lab/draft";
import { getRepository } from "@/modules/persistence/client";
import type { SimulationSession } from "@/modules/sessions/models";

interface Props {
  draft: LabDraft;
  /** Whether current inputs are valid (a simulation can run). */
  valid: boolean;
  /** Provided on pages that can save a simulation session. */
  onSaveSession?: () => Promise<SimulationSession>;
  /** Why saving a simulation must wait (e.g. live weather still loading). */
  sessionWait?: string;
  /** Extra actions, e.g. navigation to the next step. */
  actions?: React.ReactNode;
  /** A picture before the name (e.g. the current target). */
  leading?: React.ReactNode;
}

type Feedback = { tone: "ok" | "error"; text: string; href?: string; linkText?: string };

/** Name, save state and save actions for the configuration being edited. */
export function LabToolbar({ draft, valid, onSaveSession, sessionWait, actions, leading }: Props) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const config = draft.spec;
  const saved = draft.saved;
  const dirty = isDraftDirty(draft);

  async function run(action: () => Promise<Feedback>) {
    setBusy(true);
    setFeedback(undefined);
    try {
      setFeedback(await action());
    } catch (e) {
      setFeedback({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const repo = getRepository();
      const c = saved ? await repo.updateConfiguration(saved.id, config) : await repo.createConfiguration(config);
      markDraftSaved(c);
      return { tone: "ok", text: saved ? `Saved as version ${c.version}.` : "Configuration saved to My Observatory." };
    });

  const saveAsNew = () =>
    run(async () => {
      const name = saved && config.name === saved.name ? `${config.name} (variant)`.slice(0, 100) : config.name;
      const c = await getRepository().createConfiguration({ ...config, name });
      markDraftSaved(c);
      return { tone: "ok", text: `Saved as a new configuration, “${c.name}”.` };
    });

  const saveSession = () =>
    run(async () => {
      const s = await onSaveSession!();
      return { tone: "ok", text: "Simulation saved.", href: `/observatory/simulations/${s.id}`, linkText: "Open it" };
    });

  const state = !saved ? "Not saved" : dirty ? "Unsaved changes" : `Saved · v${saved.version}`;

  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
          {leading}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold tracking-tight">{config.name || "Untitled configuration"}</span>
              <StatusChip status={config.status} />
            </div>
            <p className={`text-xs ${dirty ? "text-warning" : "text-muted"}`}>
              {state}
              {!config.profileId && " · Hypothetical (not linked to your equipment)"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!canPersist(auth) ? (
            auth.mode === "supabase" && auth.status === "signed-out" ? (
              <Link href={signInHref()} className={buttonStyles({ size: "sm" })}>
                Sign in to save
              </Link>
            ) : null
          ) : (
            <>
              <Button
                // On the simulate page the simulation is the main thing to save.
                variant={saved && !dirty ? "secondary" : onSaveSession ? "secondary" : "primary"}
                size="sm"
                disabled={busy || !valid || (Boolean(saved) && !dirty)}
                onClick={save}
              >
                {saved && !dirty ? <Icons.Check className="size-4" /> : <Icons.Bookmark className="size-4" />}
                {!saved ? "Save configuration" : dirty ? "Save changes" : "Saved"}
              </Button>
              {saved && (
                <Button size="sm" disabled={busy || !valid} onClick={saveAsNew}>
                  Save as new
                </Button>
              )}
              {onSaveSession && (
                <Button variant="primary" size="sm" disabled={busy || !valid || Boolean(sessionWait)} title={sessionWait} onClick={saveSession}>
                  <Icons.Play className="size-4" />
                  Save simulation
                </Button>
              )}
            </>
          )}
          {actions}
        </div>
      </div>
      {feedback && (
        <p role="status" className={`mt-2 text-sm ${feedback.tone === "ok" ? "text-success" : "text-danger"}`}>
          {feedback.text}{" "}
          {feedback.href && (
            <Link href={feedback.href} className="underline">
              {feedback.linkText}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
