import type { Metadata } from "next";
import { ProjectsPage } from "@/components/observatory/projects-page";

export const metadata: Metadata = { title: "Observation projects" };

export default function Page() {
  return <ProjectsPage />;
}
