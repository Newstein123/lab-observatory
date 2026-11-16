import { redirect } from "next/navigation";

/** Sessions moved to /observatory/simulations; keep old links working. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/observatory/simulations/${encodeURIComponent(id)}`);
}
