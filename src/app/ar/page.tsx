import type { Metadata } from "next";
import { ArPage } from "@/components/ar/ar-page";

export const metadata: Metadata = { title: "Telescope in AR" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ArPage params={await searchParams} />;
}
