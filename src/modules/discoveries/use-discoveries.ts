"use client";

import { useCallback } from "react";
import { useMutation } from "@/components/observatory/mutations";
import { canPersist, useAuth } from "@/modules/auth/use-auth";
import { getRepository } from "@/modules/persistence/client";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import { discoveryKey, type Discovery, type DiscoveryInput } from "./models";

/** The user's saved discoveries (re-read whenever they change). */
export function useDiscoveries() {
  return useOwnerQuery((r) => r.listDiscoveries(), []);
}

/** Save, unsave and annotate discoveries, with toasts; `canSave` is false while signed out of an account. */
export function useDiscoveryActions() {
  const auth = useAuth();
  const { run, busy } = useMutation();
  const save = useCallback((input: DiscoveryInput) => run(() => getRepository().createDiscovery(input), `${input.name} saved to your discoveries`), [run]);
  const remove = useCallback((d: Pick<Discovery, "id" | "name">) => run(() => getRepository().deleteDiscovery(d.id), `${d.name} removed from your discoveries`), [run]);
  const setNote = useCallback((id: string, note: string) => run(() => getRepository().updateDiscoveryNote(id, note), "Note saved"), [run]);
  return { save, remove, setNote, busy, canSave: canPersist(auth) };
}

/** The saved record for a thing, if any. */
export function findDiscovery(list: readonly Discovery[] | undefined, key: Pick<DiscoveryInput, "targetId" | "kind" | "featureId">) {
  const k = discoveryKey(key);
  return list?.find((d) => discoveryKey(d) === k);
}
