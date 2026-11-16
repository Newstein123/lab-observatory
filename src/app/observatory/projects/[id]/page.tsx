import type { Metadata } from "next";
import { ProjectDetail } from "@/components/observatory/projects-page";

export const metadata: Metadata = { title: "Observation project" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
