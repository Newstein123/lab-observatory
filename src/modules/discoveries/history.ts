"use client";

import { useCallback, useSyncExternalStore } from "react";
import { discoveryKey, type DiscoveryInput } from "./models";

/**
 * Recently explored objects and features, on this device only (a personal
 * trail, not saved discoveries). Newest first, at most 30.
 */
export interface ExploredItem extends Pick<DiscoveryInput, "targetId" | "kind" | "featureId" | "name"> {
  at: string;
}

const KEY = "ue.explored.v1";
const MAX = 30;
const listeners = new Set<() => void>();
let cache: ExploredItem[] | undefined;

function read(): ExploredItem[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw) ? raw.filter((x) => x && typeof x.targetId === "string" && typeof x.name === "string").slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: ExploredItem[]) {
  cache = items;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable: keep it for this page only.
  }
  listeners.forEach((l) => l());
}

export function recordExplored(item: Omit<ExploredItem, "at">, at = new Date()) {
  const k = discoveryKey(item);
  write([{ ...item, at: at.toISOString() }, ...read().filter((x) => discoveryKey(x) !== k)].slice(0, MAX));
}

export function clearExplored() {
  write([]);
}

const EMPTY: ExploredItem[] = [];

export function useExploreHistory(): [ExploredItem[], () => void] {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(),
    () => EMPTY,
  );
  return [items, useCallback(() => clearExplored(), [])];
}
