import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LabHome } from "@/components/lab/lab-home";

export const metadata: Metadata = { title: "Telescope Lab" };

export default async function LabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  // Links from before the Lab had separate steps (?target, ?mode, ?config) open the simulation.
  if (params.target || params.mode || params.config) {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"));
    redirect(`/lab/simulate?${q}`);
  }
  return <LabHome />;
}
