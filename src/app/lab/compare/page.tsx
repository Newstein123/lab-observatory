import type { Metadata } from "next";
import { CompareConfigurations } from "@/components/lab/compare-configurations";

export const metadata: Metadata = { title: "Compare configurations" };

export default async function Page({ searchParams }: { searchParams: Promise<{ a?: string; b?: string; target?: string; mode?: string }> }) {
  const { a, b, target, mode } = await searchParams;
  return <CompareConfigurations initialA={a} initialB={b} initialTargetId={target} initialMode={mode === "camera" ? "camera" : "eyepiece"} />;
}
