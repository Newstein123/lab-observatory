import type { Metadata } from "next";
import { DiscoveriesPage } from "@/components/discoveries/discoveries-page";

export const metadata: Metadata = { title: "Discoveries" };

export default function Page() {
  return <DiscoveriesPage />;
}
