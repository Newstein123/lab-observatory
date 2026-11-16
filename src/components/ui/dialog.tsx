"use client";

import { useEffect, useRef } from "react";

/**
 * Modal built on the native <dialog> element (focus trap, Esc, backdrop).
 * Render it conditionally or keep it mounted and toggle `open`.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Nearly full-screen, for workspaces. */
  full?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`glass m-auto w-[calc(100%-2rem)] rounded-2xl p-0 text-foreground shadow-2xl shadow-black/60 ${
        full ? "h-[calc(100dvh-2rem)] max-h-none max-w-[1500px]" : wide ? "max-w-2xl" : "max-w-lg"
      }`}
    >
      {open && (
        <div className={full ? "flex h-full flex-col p-4 sm:p-5" : "p-5"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:text-foreground">
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
