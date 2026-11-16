/**
 * JSON with object keys sorted and undefined values dropped, so structurally
 * equal values compare equal regardless of key order (Postgres jsonb, for
 * example, does not preserve the order keys were written in).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

export function deepEqualJson(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
