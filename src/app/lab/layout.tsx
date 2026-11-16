import { LabStepper } from "@/components/lab/lab-stepper";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LabStepper />
      {children}
    </>
  );
}
