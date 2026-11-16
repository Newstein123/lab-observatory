"use client";

import { useEffect, useState } from "react";
import { decodeStars, type Star, type StarFieldData } from "@/modules/simulations/renderers/stars";
import { starFieldSrc } from "./star-fields";

export interface LoadedStarField {
  data: StarFieldData;
  stars: Star[];
}

const cache = new Map<string, Promise<LoadedStarField>>();

function load(src: string): Promise<LoadedStarField> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${src}`);
        return r.json() as Promise<StarFieldData>;
      })
      .then((data) => ({ data, stars: decodeStars(data) }));
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

/** Catalogue stars around a target, or undefined while loading / when none exist. */
export function useStarField(targetId: string, enabled = true): LoadedStarField | undefined {
  const src = enabled ? starFieldSrc(targetId) : undefined;
  const [state, setState] = useState<{ src?: string; field?: LoadedStarField }>({});
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    load(src).then(
      (field) => !cancelled && setState({ src, field }),
      () => !cancelled && setState({ src }),
    );
    return () => {
      cancelled = true;
    };
  }, [src]);
  return state.src === src ? state.field : undefined;
}
