import type {
  BarlowSpec,
  BarrelSize,
  CameraSpec,
  EyepieceSpec,
  FilterSpec,
  TelescopeOptics,
} from "@/modules/simulations/engine";
import type { AccessoryKind, MountSpec, MountType } from "./models";

/**
 * Reference equipment catalogue.
 *
 * Manufacturer and model identify an item; only the optical/sensor numbers
 * are used in calculations. Values are the manufacturers' published
 * specifications as commonly listed, not independently measured, and are
 * awaiting verification against current product documentation. Weights and
 * payloads are approximate and used only for estimated compatibility notes.
 * Inclusion is not an endorsement or a product listing.
 */

export const CATALOG_PROVENANCE = {
  kind: "retrieved" as const,
  source: "Manufacturers' published specifications",
  verification: "pending" as const,
};

export interface TelescopeCatalogEntry {
  id: string;
  manufacturer: string;
  model: string;
  optics: TelescopeOptics;
  mountType: MountType;
  /** Largest eyepiece barrel the stock focuser/visual back accepts. */
  focuserBarrelIn: BarrelSize;
  /** Optical tube weight, kg (approximate). */
  otaWeightKg?: number;
  summary: string;
}

export interface AccessoryCatalogEntry<T> {
  id: string;
  manufacturer?: string;
  model: string;
  spec: T;
  summary?: string;
}

const scope = (
  id: string,
  manufacturer: string,
  model: string,
  design: TelescopeOptics["opticalDesign"],
  apertureMm: number,
  focalLengthMm: number,
  mountType: MountType,
  focuserBarrelIn: BarrelSize,
  otaWeightKg: number,
  summary: string,
): TelescopeCatalogEntry => ({
  id,
  manufacturer,
  model,
  optics: { apertureMm, focalLengthMm, opticalDesign: design, label: `${manufacturer} ${model}` },
  mountType,
  focuserBarrelIn,
  otaWeightKg,
  summary,
});

export const TELESCOPE_CATALOG: TelescopeCatalogEntry[] = [
  scope("celestron-nexstar-8se", "Celestron", "NexStar 8SE", "catadioptric", 203, 2032, "goto", 1.25, 5.7, "Schmidt-Cassegrain on a single-arm GoTo mount. Long focal length suits planets and the Moon."),
  scope("skywatcher-explorer-200p", "Sky-Watcher", "Explorer 200P", "reflector", 200, 1000, "equatorial", 2, 8.5, "f/5 Newtonian on an equatorial mount. A versatile all-rounder."),
  scope("orion-xt10i", "Orion", "SkyQuest XT10i", "reflector", 254, 1200, "dobsonian", 2, 12.7, "10-inch Dobsonian with push-to object locator. Large aperture for faint objects."),
  scope("skywatcher-skyliner-200p", "Sky-Watcher", "Skyliner 200P Dobsonian", "reflector", 200, 1200, "dobsonian", 2, 10.5, "f/6 Dobsonian. Simple, stable and forgiving of eyepieces."),
  scope("skywatcher-quattro-200p", "Sky-Watcher", "Quattro 200P", "reflector", 200, 800, "equatorial", 2, 7.8, "Fast f/4 imaging Newtonian for wide deep-sky fields."),
  scope("skywatcher-skymax-127", "Sky-Watcher", "Skymax 127", "catadioptric", 127, 1500, "alt_azimuth", 1.25, 3.5, "Compact Maksutov-Cassegrain with sharp, high-contrast planetary views."),
  scope("skywatcher-evostar-80ed", "Sky-Watcher", "Evostar 80ED", "refractor", 80, 600, "equatorial", 2, 2.9, "Apochromatic doublet refractor. Portable and well suited to imaging."),
  scope("william-optics-redcat-51", "William Optics", "RedCat 51", "refractor", 51, 250, "equatorial", 2, 1.6, "Very short f/4.9 astrograph for wide-field imaging."),
  scope("explore-scientific-ar102", "Explore Scientific", "AR102", "refractor", 102, 663, "alt_azimuth", 2, 4.5, "f/6.5 achromatic refractor for wide-field visual observing."),
  scope("celestron-astromaster-130eq", "Celestron", "AstroMaster 130EQ", "reflector", 130, 650, "equatorial", 1.25, 4.0, "Entry-level f/5 Newtonian on an equatorial mount."),
  scope("celestron-c925", "Celestron", "C9.25", "catadioptric", 235, 2350, "equatorial", 2, 9.1, "9.25-inch Schmidt-Cassegrain optical tube."),
  scope("celestron-c11", "Celestron", "C11", "catadioptric", 280, 2800, "equatorial", 2, 12.5, "11-inch Schmidt-Cassegrain. High resolution for planets and small galaxies."),

  // Celestron
  scope("celestron-nexstar-4se", "Celestron", "NexStar 4SE", "catadioptric", 102, 1325, "goto", 1.25, 2.0, "Small Maksutov-Cassegrain on a GoTo arm. Very portable; sharp on the Moon and planets."),
  scope("celestron-nexstar-5se", "Celestron", "NexStar 5SE", "catadioptric", 125, 1250, "goto", 1.25, 2.7, "5-inch Schmidt-Cassegrain on a single-arm GoTo mount."),
  scope("celestron-nexstar-6se", "Celestron", "NexStar 6SE", "catadioptric", 150, 1500, "goto", 1.25, 3.8, "6-inch Schmidt-Cassegrain on a single-arm GoTo mount."),
  scope("celestron-nexstar-127slt", "Celestron", "NexStar 127SLT", "catadioptric", 127, 1500, "goto", 1.25, 3.0, "Maksutov-Cassegrain on a light GoTo mount. Planets and double stars."),
  scope("celestron-nexstar-130slt", "Celestron", "NexStar 130SLT", "reflector", 130, 650, "goto", 1.25, 3.2, "f/5 Newtonian on a light GoTo mount. Good for star clusters and bright nebulae."),
  scope("celestron-starsense-dx-102az", "Celestron", "StarSense Explorer DX 102AZ", "refractor", 102, 660, "alt_azimuth", 1.25, 2.7, "f/6.5 achromatic refractor with phone-guided pointing."),
  scope("celestron-astromaster-70az", "Celestron", "AstroMaster 70AZ", "refractor", 70, 900, "alt_azimuth", 1.25, 1.7, "Beginner's long-focus achromat for the Moon and planets."),
  scope("celestron-c8", "Celestron", "C8", "catadioptric", 203, 2032, "equatorial", 1.25, 5.7, "Classic 8-inch Schmidt-Cassegrain optical tube."),
  scope("celestron-c14", "Celestron", "C14", "catadioptric", 356, 3910, "equatorial", 2, 20.4, "14-inch Schmidt-Cassegrain. Very long focal length for planets and small targets."),
  scope("celestron-edgehd-8", "Celestron", "EdgeHD 8", "catadioptric", 203, 2032, "equatorial", 2, 6.4, "Aplanatic Schmidt-Cassegrain with a flat field, suited to imaging."),
  scope("celestron-edgehd-11", "Celestron", "EdgeHD 11", "catadioptric", 280, 2800, "equatorial", 2, 12.7, "11-inch aplanatic Schmidt-Cassegrain for planetary and deep-sky imaging."),

  // Sky-Watcher
  scope("skywatcher-heritage-130p", "Sky-Watcher", "Heritage 130P FlexTube", "reflector", 130, 650, "dobsonian", 1.25, 2.4, "Collapsible tabletop Dobsonian. A popular first telescope."),
  scope("skywatcher-heritage-150p", "Sky-Watcher", "Heritage 150P FlexTube", "reflector", 150, 750, "dobsonian", 1.25, 3.4, "Collapsible tabletop Dobsonian with a little more aperture."),
  scope("skywatcher-skyliner-150p", "Sky-Watcher", "Skyliner 150P Dobsonian", "reflector", 150, 1200, "dobsonian", 1.25, 6.5, "f/8 Dobsonian. Easy collimation and fine planetary views."),
  scope("skywatcher-skyliner-250px", "Sky-Watcher", "Skyliner 250PX Dobsonian", "reflector", 254, 1200, "dobsonian", 2, 13.5, "10-inch Dobsonian. Resolves many globular clusters."),
  scope("skywatcher-skyliner-300p-flextube", "Sky-Watcher", "Skyliner 300P FlexTube", "reflector", 305, 1500, "dobsonian", 2, 21, "12-inch collapsible Dobsonian for faint galaxies and nebulae."),
  scope("skywatcher-explorer-130p", "Sky-Watcher", "Explorer 130P", "reflector", 130, 900, "equatorial", 1.25, 3.5, "f/6.9 Newtonian on a light equatorial mount."),
  scope("skywatcher-explorer-150p", "Sky-Watcher", "Explorer 150P", "reflector", 150, 750, "equatorial", 2, 5.3, "f/5 Newtonian. A balance of portability and aperture."),
  scope("skywatcher-explorer-250pds", "Sky-Watcher", "Explorer 250PDS", "reflector", 254, 1200, "equatorial", 2, 12.2, "10-inch imaging Newtonian with a dual-speed focuser."),
  scope("skywatcher-quattro-250p", "Sky-Watcher", "Quattro 250P", "reflector", 250, 1000, "equatorial", 2, 12.8, "Fast f/4 10-inch imaging Newtonian."),
  scope("skywatcher-evostar-72ed", "Sky-Watcher", "Evostar 72ED", "refractor", 72, 420, "equatorial", 2, 2.0, "Small ED doublet. Wide fields and a good first imaging refractor."),
  scope("skywatcher-evostar-100ed", "Sky-Watcher", "Evostar 100ED", "refractor", 100, 900, "equatorial", 2, 4.2, "f/9 ED doublet with crisp, colour-free views."),
  scope("skywatcher-esprit-80ed", "Sky-Watcher", "Esprit 80ED", "refractor", 80, 400, "equatorial", 2, 3.6, "Triplet apochromat astrograph."),
  scope("skywatcher-esprit-100ed", "Sky-Watcher", "Esprit 100ED", "refractor", 100, 550, "equatorial", 2, 6.0, "Triplet apochromat astrograph with a flat field."),
  scope("skywatcher-skymax-102", "Sky-Watcher", "Skymax 102", "catadioptric", 102, 1300, "alt_azimuth", 1.25, 1.9, "Compact Maksutov-Cassegrain; a good travel telescope."),
  scope("skywatcher-skymax-150-pro", "Sky-Watcher", "Skymax 150 Pro", "catadioptric", 150, 1800, "equatorial", 2, 5.2, "6-inch Maksutov-Cassegrain for planets and the Moon."),
  scope("skywatcher-skymax-180-pro", "Sky-Watcher", "Skymax 180 Pro", "catadioptric", 180, 2700, "equatorial", 2, 7.0, "7-inch Maksutov-Cassegrain with a long f/15 focal ratio."),
  scope("skywatcher-startravel-102", "Sky-Watcher", "StarTravel 102", "refractor", 102, 500, "alt_azimuth", 1.25, 2.7, "Short f/4.9 achromat for wide, low-power sweeping."),

  // Orion
  scope("orion-xt6", "Orion", "SkyQuest XT6", "reflector", 150, 1200, "dobsonian", 1.25, 5.4, "6-inch f/8 Dobsonian. Simple and sharp."),
  scope("orion-xt8", "Orion", "SkyQuest XT8", "reflector", 203, 1200, "dobsonian", 2, 9.5, "8-inch Dobsonian. Often recommended as a first serious telescope."),
  scope("orion-xt12i", "Orion", "SkyQuest XT12i", "reflector", 305, 1500, "dobsonian", 2, 19, "12-inch Dobsonian with push-to object locator."),
  scope("orion-starblast-4-5", "Orion", "StarBlast 4.5", "reflector", 114, 450, "dobsonian", 1.25, 2.0, "Wide-field f/4 tabletop reflector."),

  // Apertura and Zhumell
  scope("apertura-ad8", "Apertura", "AD8", "reflector", 203, 1200, "dobsonian", 2, 10, "8-inch Dobsonian with a dual-speed focuser."),
  scope("apertura-ad10", "Apertura", "AD10", "reflector", 254, 1250, "dobsonian", 2, 13.4, "10-inch Dobsonian with a dual-speed focuser."),
  scope("zhumell-z10", "Zhumell", "Z10", "reflector", 254, 1250, "dobsonian", 2, 13.4, "10-inch Dobsonian."),

  // Meade
  scope("meade-etx125-observer", "Meade", "ETX125 Observer", "catadioptric", 127, 1900, "goto", 1.25, 3.5, "Maksutov-Cassegrain on a fork GoTo mount."),
  scope("meade-lx90-8-acf", "Meade", "LX90 8″ ACF", "catadioptric", 203, 2000, "goto", 1.25, 6.4, "8-inch ACF Schmidt-Cassegrain on a fork GoTo mount."),
  scope("meade-lx200-10-acf", "Meade", "LX200 10″ ACF", "catadioptric", 254, 2500, "goto", 2, 13, "10-inch ACF Schmidt-Cassegrain on a fork GoTo mount."),

  // Explore Scientific, William Optics, Askar, Vixen
  scope("explore-scientific-ed102-fcd100", "Explore Scientific", "ED102 FCD-100", "refractor", 102, 714, "equatorial", 2, 4.5, "f/7 apochromatic triplet."),
  scope("william-optics-zenithstar-61", "William Optics", "Zenithstar 61", "refractor", 61, 360, "equatorial", 2, 1.8, "Small f/5.9 apochromat for wide-field imaging."),
  scope("william-optics-zenithstar-73", "William Optics", "Zenithstar 73", "refractor", 73, 430, "equatorial", 2, 2.4, "f/5.9 apochromat; visual and imaging."),
  scope("william-optics-redcat-71", "William Optics", "RedCat 71", "refractor", 71, 350, "equatorial", 2, 2.8, "Petzval astrograph with a built-in flat field."),
  scope("askar-fra400", "Askar", "FRA400", "refractor", 72, 400, "equatorial", 2, 3.0, "f/5.6 quintuplet astrograph with a flat field."),
  scope("vixen-ed80sf", "Vixen", "ED80Sf", "refractor", 80, 600, "equatorial", 2, 2.3, "f/7.5 ED doublet."),

  // Takahashi and Tele Vue
  scope("takahashi-fsq-85edx", "Takahashi", "FSQ-85EDX", "refractor", 85, 450, "equatorial", 2, 3.1, "Compact Petzval astrograph with a very flat field."),
  scope("takahashi-fsq-106edx4", "Takahashi", "FSQ-106EDX4", "refractor", 106, 530, "equatorial", 2, 6.1, "Renowned wide-field Petzval astrograph."),
  scope("takahashi-fc-100dl", "Takahashi", "FC-100DL", "refractor", 100, 900, "equatorial", 2, 3.6, "f/9 fluorite doublet with excellent planetary contrast."),
  scope("takahashi-toa-130nfb", "Takahashi", "TOA-130NFB", "refractor", 130, 1000, "equatorial", 2, 9.4, "5-inch oil-spaced triplet apochromat."),
  scope("televue-60", "Tele Vue", "TV-60", "refractor", 60, 360, "alt_azimuth", 1.25, 1.4, "Tiny f/6 apochromat for travel and wide fields."),
  scope("televue-85", "Tele Vue", "TV-85", "refractor", 85, 600, "alt_azimuth", 2, 3.1, "f/7 apochromat; an all-round visual refractor."),
  scope("televue-np101is", "Tele Vue", "NP101is", "refractor", 101, 540, "alt_azimuth", 2, 4.8, "Nagler-Petzval apochromat with a flat imaging field."),
];

const ep = (
  id: string,
  manufacturer: string | undefined,
  model: string,
  focalLengthMm: number,
  apparentFovDeg: number,
  barrelIn: BarrelSize,
  eyeReliefMm?: number,
  fieldStopMm?: number,
): AccessoryCatalogEntry<EyepieceSpec> => ({
  id,
  manufacturer,
  model,
  spec: {
    focalLengthMm,
    apparentFovDeg,
    barrelIn,
    ...(eyeReliefMm ? { eyeReliefMm } : {}),
    ...(fieldStopMm ? { fieldStopMm } : {}),
    label: manufacturer ? `${manufacturer} ${model}` : model,
  },
});

export const EYEPIECE_CATALOG: AccessoryCatalogEntry<EyepieceSpec>[] = [
  ep("ep-32-52", undefined, "Plössl 32 mm", 32, 52, 1.25, 22),
  ep("ep-25-50", undefined, "Plössl 25 mm", 25, 50, 1.25, 17),
  ep("ep-10-52", undefined, "Plössl 10 mm", 10, 52, 1.25, 7),
  ep("ep-6-82", undefined, "Wide-field 6 mm 82°", 6, 82, 1.25, 13),
  ep("tv-plossl-32", "Tele Vue", "Plössl 32 mm", 32, 50, 1.25, 22, 27),
  ep("tv-panoptic-24", "Tele Vue", "Panoptic 24 mm", 24, 68, 1.25, 15, 27),
  ep("tv-nagler-13-t6", "Tele Vue", "Nagler 13 mm Type 6", 13, 82, 1.25, 12, 17.6),
  ep("tv-delos-6", "Tele Vue", "Delos 6 mm", 6, 72, 1.25, 20),
  ep("tv-ethos-13", "Tele Vue", "Ethos 13 mm", 13, 100, 2, 15),
  ep("baader-morpheus-9", "Baader", "Morpheus 9 mm", 9, 76, 1.25, 20),
  ep("es-82-30", "Explore Scientific", "82° 30 mm", 30, 82, 2, 22),
  ep("es-68-40", "Explore Scientific", "68° 40 mm", 40, 68, 2),
];

const cam = (
  id: string,
  manufacturer: string | undefined,
  model: string,
  sensorWidthMm: number,
  sensorHeightMm: number,
  pixelSizeUm: number,
  resolutionX: number,
  resolutionY: number,
  color: boolean,
  summary: string,
): AccessoryCatalogEntry<CameraSpec> => ({
  id,
  manufacturer,
  model,
  summary,
  spec: {
    sensorWidthMm,
    sensorHeightMm,
    pixelSizeUm,
    resolutionX,
    resolutionY,
    color,
    label: manufacturer ? `${manufacturer} ${model}` : model,
  },
});

/** Sensor dimensions follow from the published pixel count × pixel size. */
export const CAMERA_CATALOG: AccessoryCatalogEntry<CameraSpec>[] = [
  cam("zwo-asi2600mc-pro", "ZWO", "ASI2600MC Pro", 23.5, 15.7, 3.76, 6248, 4176, true, "Cooled APS-C colour camera (IMX571)."),
  cam("zwo-asi2600mm-pro", "ZWO", "ASI2600MM Pro", 23.5, 15.7, 3.76, 6248, 4176, false, "Cooled APS-C monochrome camera (IMX571)."),
  cam("zwo-asi533mc-pro", "ZWO", "ASI533MC Pro", 11.31, 11.31, 3.76, 3008, 3008, true, "Cooled 1-inch square colour camera (IMX533)."),
  cam("zwo-asi585mc", "ZWO", "ASI585MC", 11.14, 6.26, 2.9, 3840, 2160, true, "Planetary and lunar colour camera (IMX585)."),
  cam("zwo-asi462mc", "ZWO", "ASI462MC", 5.61, 3.18, 2.9, 1936, 1096, true, "Small-sensor planetary colour camera (IMX462)."),
  cam("generic-ff-24mp", undefined, "Full-frame camera, 24 MP", 35.9, 23.9, 5.98, 6000, 4000, true, "Typical full-frame mirrorless or DSLR body."),
];

export const BARLOW_CATALOG: AccessoryCatalogEntry<BarlowSpec>[] = [
  { id: "barlow-2x", model: "2× Barlow", spec: { factor: 2, barrelIn: 1.25, label: "2× Barlow" } },
  { id: "barlow-3x", model: "3× Barlow", spec: { factor: 3, barrelIn: 1.25, label: "3× Barlow" } },
  { id: "tv-powermate-2_5x", manufacturer: "Tele Vue", model: "Powermate 2.5×", spec: { factor: 2.5, barrelIn: 1.25, label: "Tele Vue Powermate 2.5×" } },
  { id: "es-focal-extender-2x", manufacturer: "Explore Scientific", model: "2× Focal Extender 2″", spec: { factor: 2, barrelIn: 2, label: "Explore Scientific 2× Focal Extender 2″" } },
];

export const FILTER_CATALOG: AccessoryCatalogEntry<FilterSpec>[] = [
  { id: "filter-nd09", model: "Moon ND 0.9", summary: "Neutral density, about 13% transmission. Cuts lunar glare.", spec: { name: "Moon ND 0.9", kind: "neutral_density" } },
  { id: "filter-uhc", model: "UHC", summary: "Narrow band-pass for emission nebulae (Hβ + OIII).", spec: { name: "UHC", kind: "uhc" } },
  { id: "filter-oiii", model: "OIII", summary: "Very narrow OIII line filter for planetary and emission nebulae.", spec: { name: "OIII", kind: "oiii" } },
  { id: "filter-lpr", model: "Light-pollution (broadband)", summary: "Suppresses common street-light emission lines.", spec: { name: "Light-pollution", kind: "light_pollution" } },
  { id: "filter-80a", model: "#80A Blue", summary: "Planetary colour filter; can enhance Jupiter's belts.", spec: { name: "#80A Blue", kind: "color_blue" } },
  { id: "filter-21", model: "#21 Orange", summary: "Planetary colour filter; can enhance Mars and Saturn detail.", spec: { name: "#21 Orange", kind: "color_orange" } },
];

const mount = (id: string, manufacturer: string | undefined, model: string, spec: Omit<MountSpec, "label">): AccessoryCatalogEntry<MountSpec> => ({
  id,
  manufacturer,
  model,
  spec: { ...spec, label: manufacturer ? `${manufacturer} ${model}` : model },
});

export const MOUNT_CATALOG: AccessoryCatalogEntry<MountSpec>[] = [
  mount("mount-dob-base", undefined, "Dobsonian rocker base", { type: "dobsonian", goto: false, tracking: false }),
  mount("mount-altaz-manual", undefined, "Manual alt-azimuth", { type: "alt_azimuth", payloadKg: 7, goto: false, tracking: false }),
  mount("skywatcher-az-gti", "Sky-Watcher", "AZ-GTi", { type: "alt_azimuth", payloadKg: 5, goto: true, tracking: true }),
  mount("skywatcher-eq5", "Sky-Watcher", "EQ5", { type: "equatorial", payloadKg: 9, goto: false, tracking: false }),
  mount("skywatcher-heq5-pro", "Sky-Watcher", "HEQ5 Pro", { type: "equatorial", payloadKg: 13.6, goto: true, tracking: true }),
  mount("skywatcher-eq6r-pro", "Sky-Watcher", "EQ6-R Pro", { type: "equatorial", payloadKg: 20, goto: true, tracking: true }),
];

export const CATALOGS = {
  eyepiece: EYEPIECE_CATALOG,
  camera: CAMERA_CATALOG,
  barlow: BARLOW_CATALOG,
  filter: FILTER_CATALOG,
  mount: MOUNT_CATALOG,
} satisfies Record<AccessoryKind, AccessoryCatalogEntry<unknown>[]>;

export function getTelescopeEntry(id: string | undefined): TelescopeCatalogEntry | undefined {
  return id ? TELESCOPE_CATALOG.find((t) => t.id === id) : undefined;
}

export function displayName(e: { manufacturer?: string; model: string }): string {
  return e.manufacturer ? `${e.manufacturer} ${e.model}` : e.model;
}

export const MANUFACTURERS = [...new Set(TELESCOPE_CATALOG.map((t) => t.manufacturer))].sort();

/** A few items to feature on the Lab home page. */
export const FEATURED = {
  telescopes: ["celestron-nexstar-8se", "skywatcher-explorer-200p", "orion-xt10i"],
  eyepieceId: "tv-panoptic-24",
  cameraId: "zwo-asi533mc-pro",
};
