import type { Metadata } from "next";
import { SessionViewer } from "@/components/observatory/session-viewer";

export const metadata: Metadata = { title: "Saved simulation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionViewer id={id} />;
}
