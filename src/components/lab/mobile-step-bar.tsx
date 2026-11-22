/**
 * Phones and tablets: keeps a Lab step's "next" action in reach, pinned above
 * the mobile tab bar (at the bottom of the screen from md up), instead of only
 * at the top or the end of a long page. Hidden on wide screens, where the
 * action is always visible. Pages that show it add bottom padding (max-xl:pb-24)
 * so it never covers their last content.
 */
export function MobileStepBar({ label, title, subtitle, children }: { label: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md md:bottom-0 xl:hidden"
    >
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <div className="min-w-0 flex-1">
          {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}
          <p className="truncate text-sm font-medium">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
