"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { Icons } from "@/components/ui/icons";

const NAV = [
  { href: "/lab", label: "Telescope Lab", icon: Icons.Telescope },
  { href: "/observatory", label: "My Observatory", icon: Icons.Home },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Top bar on every page, plus a bottom tab bar on small screens. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Icons.Logo className="size-7" />
            <span>Universal Observatory</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center text-sm md:flex">
            {NAV.map((item, i) => {
              const active = isActive(pathname, item.href);
              return (
                <div key={item.href} className="flex items-center">
                  {i > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border-strong" />}
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      active ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </div>
              );
            })}
          </nav>
          <p className="ml-auto hidden text-sm italic text-muted xl:block">Configure. Simulate. Preserve.</p>
          <div className="ml-auto xl:ml-4">
            <AccountMenu />
          </div>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-accent" : "text-muted"}`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
