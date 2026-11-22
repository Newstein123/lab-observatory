import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        title="Page not found"
        action={
          <>
            <Link href="/lab" className={buttonStyles({ variant: "primary", size: "sm" })}>
              Telescope Lab
            </Link>
            <Link href="/observatory" className={buttonStyles({ size: "sm" })}>
              My Observatory
            </Link>
          </>
        }
      >
        There is nothing at this address. It may have moved, or the link may be mistyped.
      </EmptyState>
    </main>
  );
}
