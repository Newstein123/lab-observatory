"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInPrompt } from "@/components/auth/account-menu";
import { Icons } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/states";
import { useAuth } from "@/modules/auth/use-auth";

const NAV = [
  { href: "/observatory", label: "Overview", icon: Icons.Grid, exact: true },
  { href: "/observatory/equipment", label: "My Equipment", icon: Icons.Telescope },
  { href: "/observatory/configurations", label: "Configurations", icon: Icons.Layers },
  { href: "/observatory/simulations", label: "Simulations", icon: Icons.Play },
  { href: "/observatory/projects", label: "Projects", icon: Icons.Folder },
];

/** Sidebar layout for My Observatory; private pages need an account (or local mode). */
export function ObservatoryShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside>
        <nav aria-label="My Observatory" className="glass flex gap-1 overflow-x-auto rounded-xl p-2 lg:sticky lg:top-20 lg:flex-col">
          <p className="hidden px-3 pb-2 pt-1 text-sm font-semibold lg:block">My Observatory</p>
          {NAV.map((n) => {
            const on = active(n.href, n.exact);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  on ? "bg-surface-raised text-foreground" : "text-muted hover:bg-surface-raised/60 hover:text-foreground"
                }`}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
          <span
            aria-disabled
            title="Planned for a later release"
            className="flex shrink-0 cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-subtle"
          >
            <Icons.Building className="size-4" />
            Observatory design
            <span className="rounded-full border border-border px-1.5 text-[10px] uppercase tracking-wide">Later</span>
          </span>
        </nav>
        <p className="mt-3 hidden px-1 text-xs text-subtle lg:block">
          {auth.mode === "local" ? "Stored privately in this browser." : "Private to your account."}
        </p>
      </aside>
      <div className="min-w-0">
        {auth.mode === "supabase" && auth.status === "loading" ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40" />
          </div>
        ) : auth.mode === "supabase" && auth.status === "signed-out" ? (
          <SignInPrompt />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Page heading used across My Observatory. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
