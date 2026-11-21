"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";

const STEPS = [
  { href: "/lab/new", label: "Telescope" },
  { href: "/lab/configure", label: "Equipment" },
  { href: "/lab/simulate", label: "Simulate" },
  { href: "/lab/compare", label: "Compare" },
];

/** Step bar for the Telescope Lab workflow (hidden on the Lab home). */
export function LabStepper() {
  const pathname = usePathname();
  if (pathname === "/lab") return null;
  const current = STEPS.findIndex((s) => pathname.startsWith(s.href));
  const tonight = pathname.startsWith("/lab/tonight");
  return (
    <nav aria-label="Telescope Lab steps" className="border-b border-border/70 bg-surface/40">
      <ol className="mx-auto flex max-w-[1680px] items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <li className="shrink-0">
          <Link href="/lab" className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-muted hover:text-foreground">
            <Icons.Home className="size-4" />
            Lab home
          </Link>
        </li>
        {STEPS.map((s, i) => {
          const active = i === current;
          const done = current > i;
          return (
            <li key={s.href} className="flex shrink-0 items-center gap-1">
              <Icons.Chevron className="size-3.5 text-subtle" />
              <Link
                href={s.href}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1 transition-colors ${
                  active ? "bg-accent/15 text-foreground ring-1 ring-accent/40" : "text-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`relative flex size-5 items-center justify-center rounded-full text-[11px] font-medium ${
                    active ? "bg-accent-strong text-accent-foreground" : done ? "bg-accent/20 text-accent" : "border border-border-strong text-muted"
                  }`}
                >
                  {done ? (
                    <>
                      <Icons.Check className="size-3" />
                      <span className="sr-only">{i + 1}</span>
                    </>
                  ) : (
                    i + 1
                  )}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
        <li className="ml-auto shrink-0 pl-3">
          <Link
            href="/lab/tonight"
            aria-current={tonight ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-colors ${
              tonight ? "bg-accent/15 text-foreground ring-1 ring-accent/40" : "text-accent hover:text-foreground"
            }`}
          >
            <Icons.Moon className="size-4" />
            What&apos;s up tonight?
            <Icons.Chevron className="size-3.5" />
          </Link>
        </li>
      </ol>
    </nav>
  );
}
