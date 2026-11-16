import type { Metadata } from "next";
import { EquipmentConfigurator, type Category } from "@/components/lab/equipment-configurator";

export const metadata: Metadata = { title: "Configure equipment" };

const CATEGORIES: Category[] = ["telescope", "mount", "eyepiece", "camera", "barlow", "filter"];

export default async function Page({ searchParams }: { searchParams: Promise<{ config?: string; category?: string }> }) {
  const { config, category } = await searchParams;
  return (
    <EquipmentConfigurator
      key={config ?? "draft"}
      configId={config}
      initialCategory={CATEGORIES.find((c) => c === category) ?? "telescope"}
    />
  );
}
