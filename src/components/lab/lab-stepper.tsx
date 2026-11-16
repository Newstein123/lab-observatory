"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav aria-label="Telescope Lab steps" className="border-b border-border/70 bg-surface/40">
      <ol className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <li className="shrink-0">
          <Link href="/lab" className="mr-2 whitespace-nowrap rounded-md px-2 py-1 text-muted hover:text-foreground">
            Lab home
          </Link>
        </li>
        {STEPS.map((s, i) => {
          const active = i === current;
          const done = current > i;
          return (
            <li key={s.href} className="flex shrink-0 items-center gap-1">
              <span aria-hidden className="text-subtle">
                /
              </span>
              <Link
                href={s.href}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
                  active ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] font-medium ${
                    active ? "bg-accent-strong text-accent-foreground" : done ? "bg-accent/20 text-accent" : "border border-border-strong text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
