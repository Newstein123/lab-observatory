"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { Icons } from "@/components/ui/icons";
import { TargetSearch } from "@/components/target-search";

const NAV = [
  { href: "/lab", label: "Telescope Lab", icon: Icons.Telescope },
  { href: "/observatory", label: "My Observatory", icon: Icons.Home },
  { href: "/discoveries", label: "Discoveries", icon: Icons.Bookmark },
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
        <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-8 px-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Icons.Logo className="size-7" />
            <span className="text-[17px]">Universal Observatory</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <div key={item.href} className="flex items-center">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3.5 py-1.5 transition-colors ${
                      active ? "bg-accent-strong font-medium text-accent-foreground shadow-glow" : "text-muted hover:bg-surface-raised/70 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </div>
              );
            })}
          </nav>
          <div className="ml-auto hidden w-80 md:block lg:w-96">
            <TargetSearch />
          </div>
          <div className="ml-auto md:ml-2">
            <AccountMenu />
          </div>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
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
