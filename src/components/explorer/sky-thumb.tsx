"use client";

import { getReferenceImage } from "@/modules/targets/reference-images";

/** A crop of a target's survey image around a catalogued position (real imagery). */
export function SkyThumb({ targetId, raDeg, decDeg, spanArcmin = 12, size = 64, className = "" }: { targetId: string; raDeg: number; decDeg: number; spanArcmin?: number; size?: number; className?: string }) {
  const image = getReferenceImage(targetId);
  if (!image || image.kind !== "field") return null;
  const d0 = (image.center.decDeg * Math.PI) / 180;
  const eastArcsec = (raDeg - image.center.raDeg) * Math.cos(d0) * 3600;
  const northArcsec = (decDeg - image.center.decDeg) * 3600;
  const scale = size / (spanArcmin * 60); // px per arcsec
  const bgW = image.fieldWidthArcsec * scale;
  const bgH = image.fieldHeightArcsec * scale;
  // East is left in the image.
  const x = bgW / 2 - eastArcsec * scale;
  const y = bgH / 2 - northArcsec * scale;
  return (
    <div
      role="img"
      aria-label="Survey image of the area"
      className={`shrink-0 overflow-hidden rounded-xl border border-border bg-black ${className}`}
      style={{ width: size, height: size, backgroundImage: `url(${image.src})`, backgroundSize: `${bgW}px ${bgH}px`, backgroundPosition: `${size / 2 - x}px ${size / 2 - y}px` }}
    />
  );
}
