import * as THREE from "three";

/**
 * Shared physically based materials. 1 scene unit = 100 mm, so every model
 * is built from real dimensions (see `mm`).
 */
export const mm = (v: number) => v / 100;

let cache: ReturnType<typeof create> | undefined;

function create() {
  return {
    anodized: new THREE.MeshStandardMaterial({ color: "#17191f", metalness: 0.65, roughness: 0.42 }),
    anodizedLight: new THREE.MeshStandardMaterial({ color: "#2a2e38", metalness: 0.7, roughness: 0.38 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#0b0c0f", metalness: 0, roughness: 0.92 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#d4d7de", metalness: 1, roughness: 0.16 }),
    satin: new THREE.MeshStandardMaterial({ color: "#9aa0ab", metalness: 0.9, roughness: 0.32 }),
    tubeWhite: new THREE.MeshPhysicalMaterial({ color: "#e8eaef", metalness: 0.1, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    tubeDark: new THREE.MeshPhysicalMaterial({ color: "#1d212b", metalness: 0.45, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    tubeInterior: new THREE.MeshStandardMaterial({ color: "#050506", metalness: 0, roughness: 1, side: THREE.BackSide }),
    flatBlack: new THREE.MeshStandardMaterial({ color: "#08090b", metalness: 0, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: "#2b2f37", metalness: 0.05, roughness: 0.75 }),
    accent: new THREE.MeshStandardMaterial({ color: "#7d86c9", metalness: 0.9, roughness: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: "#b8a375", metalness: 1, roughness: 0.3 }),
    // Multi-coated optics: dark, glossy, with a thin-film tint that shifts with angle.
    glass: new THREE.MeshPhysicalMaterial({
      color: "#0d1430",
      metalness: 0,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 1,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [180, 520],
      envMapIntensity: 1.6,
    }),
    mirror: new THREE.MeshStandardMaterial({ color: "#e6e8ee", metalness: 1, roughness: 0.05 }),
    sensor: new THREE.MeshPhysicalMaterial({
      color: "#120a24",
      metalness: 0.6,
      roughness: 0.15,
      iridescence: 1,
      iridescenceThicknessRange: [300, 800],
    }),
  };
}

export function materials() {
  cache ??= create();
  return cache;
}

/** Tinted glass for a filter of a given kind. */
const FILTER_TINTS: Record<string, string> = {
  neutral_density: "#3b3f47",
  uhc: "#3a8f8a",
  oiii: "#2fae7a",
  light_pollution: "#a06a3a",
  color_blue: "#2846c8",
  color_orange: "#e0701c",
  other: "#5b6280",
};

export function filterGlass(kind: string | undefined) {
  return new THREE.MeshPhysicalMaterial({
    color: FILTER_TINTS[kind ?? "other"] ?? FILTER_TINTS.other,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.55,
    thickness: 0.05,
    clearcoat: 1,
    iridescence: 0.6,
    transparent: true,
    opacity: 0.9,
  });
}

/** A transparent texture with engraved-looking text, for wrapping round a barrel. */
export function labelTexture(text: string, repeat = 2): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(225,228,238,0.92)";
  ctx.font = "600 44px ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let i = 0; i < repeat; i++) ctx.fillText(text, ((i + 0.5) * canvas.width) / repeat, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Lathe geometry from a radius/height profile given in millimetres. */
export function lathe(profile: [number, number][], segments = 72): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(mm(r), mm(y))),
    segments,
  );
}
