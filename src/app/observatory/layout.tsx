import { ObservatoryShell } from "@/components/observatory/observatory-shell";

export default function ObservatoryLayout({ children }: { children: React.ReactNode }) {
  return <ObservatoryShell>{children}</ObservatoryShell>;
}
