import type { Metadata } from "next";
import { ConfigurationsPage } from "@/components/observatory/configurations-page";

export const metadata: Metadata = { title: "Configurations" };

export default function Page() {
  return <ConfigurationsPage />;
}
