import type { Metadata } from "next";
import { ChooseTelescope, type ChooseTab } from "@/components/lab/choose-telescope";

export const metadata: Metadata = { title: "Choose a telescope" };

const TABS: ChooseTab[] = ["catalog", "custom", "mine"];

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initial = TABS.find((t) => t === tab) ?? "catalog";
  return <ChooseTelescope key={initial} initialTab={initial} />;
}
