import type { Metadata } from "next";
import { EquipmentPage } from "@/components/observatory/equipment-page";

export const metadata: Metadata = { title: "My Equipment" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <EquipmentPage initialTab={tab === "accessories" ? "accessories" : "telescopes"} />;
}
