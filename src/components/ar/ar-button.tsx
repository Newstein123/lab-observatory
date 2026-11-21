"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { arPath, toArSetup, type ArSetup } from "@/modules/lab/ar-link";
import { telescopeOpticsSchema } from "@/modules/simulations/engine";

const ArViewer = dynamic(() => import("./ar-viewer"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex h-full items-center justify-center text-sm text-muted">
      Loading AR viewer…
    </div>
  ),
});

type SpecLike = Parameters<typeof toArSetup>[0];

/** Phones and tablets go straight to the full-screen AR page; desktops get a preview and a QR code. */
function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

export function ArButton({ spec, mode, className = "" }: { spec: SpecLike; mode: ArSetup["mode"]; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const valid = telescopeOpticsSchema.safeParse(spec.telescope).success;
  if (!valid) return null;
  const setup = toArSetup(spec, mode);

  return (
    <>
      <button
        type="button"
        onClick={() => (isTouchDevice() ? router.push(arPath(setup)) : setOpen(true))}
        aria-label="View in augmented reality (AR)"
        title="View in AR: place the telescope at true size in your room"
        className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background/70 px-2 text-xs font-semibold text-muted backdrop-blur transition-colors hover:border-accent hover:text-foreground ${className}`}
      >
        <ArIcon className="size-4" />
        AR
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="View in AR" wide>
        {open && <ArDesktopPanel setup={setup} />}
      </Dialog>
    </>
  );
}

function ArDesktopPanel({ setup }: { setup: ArSetup }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
      <ArViewer setup={setup} className="h-[340px]" />
      <ArQrCode path={arPath(setup)} />
    </div>
  );
}

/** QR code to open the same setup on a phone. */
export function ArQrCode({ path }: { path: string }) {
  const [svg, setSvg] = useState<string>();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    // On localhost, a phone needs the public tunnel address (`make start` /
    // `make tunnel`). Ask the dev server for the current one, since a dropped
    // tunnel is reopened at a new address; the start-up value is the fallback.
    const tunnelOrigin = async (): Promise<string | undefined> => {
      if (!isLocalHost(window.location.hostname)) return undefined;
      try {
        const r = await fetch("/api/dev/tunnel", { cache: "no-store" });
        // The dev server knows: an open tunnel's address, or none (never a stale one).
        if (r.ok) return ((await r.json()) as { url: string | null }).url ?? undefined;
      } catch {
        // Not reachable: fall back below.
      }
      return process.env.NEXT_PUBLIC_DEV_PUBLIC_ORIGIN || undefined;
    };
    tunnelOrigin()
      .then((tunnel) => {
        const full = `${tunnel ?? window.location.origin}${path}`;
        if (cancelled) return;
        setUrl(full);
        return import("qrcode").then((QR) =>
          QR.toString(full, { type: "svg", margin: 1, errorCorrectionLevel: "L", color: { dark: "#000000", light: "#ffffff" } }),
        );
      })
      .then((s) => !cancelled && s && setSvg(s))
      .catch(() => !cancelled && setSvg(undefined));
    return () => {
      cancelled = true;
    };
  }, [path]);
  const local = url ? isLocalHost(new URL(url).hostname) : false;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-sm font-medium">Open on your phone</p>
      {svg ? (
        // Generated locally from our own URL; contains only the QR drawing.
        <div role="img" aria-label="QR code linking to this setup in AR" className="w-full max-w-[220px] rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="aspect-square w-full max-w-[220px] animate-pulse rounded-lg bg-surface-raised" />
      )}
      <p className="text-xs text-muted">Scan with the camera app. AR works on iPhone/iPad (iOS 12+) and on Android phones with ARCore in Chrome.</p>
      {local && (
        <p className="text-xs text-warning">
          This link points at localhost, which your phone cannot reach: no public tunnel is open. Run <code>make tunnel</code> (or{" "}
          <code>make start</code>), then reopen this, or open the deployed site.
        </p>
      )}
      {url && (
        <button type="button" className="text-xs text-accent hover:underline" onClick={() => navigator.clipboard?.writeText(url)}>
          Copy link
        </button>
      )}
    </div>
  );
}

function isLocalHost(hostname: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(hostname);
}

function ArIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  );
}

export { ArViewer };
