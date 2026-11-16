import type { Metadata } from "next";
import { LabWorkspace } from "@/components/lab/lab-workspace";

export const metadata: Metadata = { title: "Observation simulation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ target?: string; mode?: string; config?: string }> }) {
  const { target, mode, config } = await searchParams;
  return (
    <LabWorkspace
      // Remount when a different saved configuration is opened.
      key={config ?? "draft"}
      initialTargetId={target}
      initialMode={mode === "camera" ? "camera" : "eyepiece"}
      initialConfigId={config}
    />
  );
}
