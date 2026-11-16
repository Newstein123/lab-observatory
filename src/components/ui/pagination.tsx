"use client";

import { pageItems } from "@/lib/pagination";
import { Icons } from "./icons";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = "Pages",
  className = "",
}: {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav aria-label={label} className={`flex items-center justify-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} border border-border text-muted hover:text-foreground`}
      >
        <Icons.Back className="size-4" />
        <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
      </button>
      <ul className="flex items-center gap-1">
        {pageItems(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`${btn} ${p === page ? "bg-accent font-medium text-white" : "text-muted hover:bg-surface-raised hover:text-foreground"}`}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className={`${btn} border border-border text-muted hover:text-foreground`}
      >
        <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
        <Icons.Chevron className="size-4" />
      </button>
    </nav>
  );
}
