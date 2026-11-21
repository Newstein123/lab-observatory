/** Small angle helpers shared by the sky calculations (degrees in, degrees out). */

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const sin = (deg: number) => Math.sin(deg * D2R);
export const cos = (deg: number) => Math.cos(deg * D2R);
export const tan = (deg: number) => Math.tan(deg * D2R);
export const asin = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) * R2D;
export const acos = (x: number) => Math.acos(Math.max(-1, Math.min(1, x))) * R2D;
export const atan2 = (y: number, x: number) => Math.atan2(y, x) * R2D;

/** Wrap to 0…360°. */
export const norm360 = (deg: number) => ((deg % 360) + 360) % 360;
/** Wrap to −180…180°. */
export const norm180 = (deg: number) => norm360(deg + 180) - 180;

export const AU_KM = 149_597_870.7;
