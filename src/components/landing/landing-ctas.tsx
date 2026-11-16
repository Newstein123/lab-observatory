"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/use-auth";

/** Calls to action that adapt to whether the visitor has an account session. */
export function LandingCtas() {
  const auth = useAuth();
  const signedIn = auth.mode === "local" || auth.status === "signed-in";

  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/lab" className={buttonStyles({ variant: "primary", size: "lg" })}>
        Open Telescope Lab
      </Link>
      {signedIn ? (
        <Link href="/observatory" className={buttonStyles({ size: "lg" })}>
          Go to My Observatory
        </Link>
      ) : (
        <Link href="/sign-in?next=%2Fobservatory" className={buttonStyles({ size: "lg" })}>
          Create a free account
        </Link>
      )}
    </div>
  );
}
