import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObservatoryOverview } from "@/components/observatory/overview";

export const metadata: Metadata = { title: "My Observatory" };

const LEGACY_TABS: Record<string, string> = {
  equipment: "/observatory/equipment",
  configurations: "/observatory/configurations",
  sessions: "/observatory/simulations",
};

export default async function ObservatoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab && LEGACY_TABS[tab]) redirect(LEGACY_TABS[tab]);
  return <ObservatoryOverview />;
}
