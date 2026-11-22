import type { Metadata } from "next";
import { AuthCallback } from "@/components/auth/auth-callback";

export const metadata: Metadata = { title: "Signing in" };

export default function AuthCallbackPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <AuthCallback />
    </main>
  );
}
