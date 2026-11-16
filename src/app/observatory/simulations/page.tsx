import type { Metadata } from "next";
import { SimulationsPage } from "@/components/observatory/simulations-page";

export const metadata: Metadata = { title: "Simulations" };

export default function Page() {
  return <SimulationsPage />;
}
