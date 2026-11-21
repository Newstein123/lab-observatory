import type { Metadata } from "next";
import { TonightPlanner } from "@/components/lab/tonight-planner";

export const metadata: Metadata = { title: "What's up tonight" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <TonightPlanner initialMode={mode === "camera" ? "camera" : "eyepiece"} />;
}
