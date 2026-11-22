/** The error Supabase puts on an auth email link that failed (expired, already used…), from the query or the hash. */
export function linkError(location: Pick<Location, "search" | "hash">): string | undefined {
  for (const part of [location.search, location.hash.replace(/^#/, "?")]) {
    const params = new URLSearchParams(part);
    const description = params.get("error_description") ?? params.get("error");
    if (description) return description.replace(/\+/g, " ");
  }
  return undefined;
}
