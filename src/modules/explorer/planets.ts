/**
 * Explorer metadata for Jupiter and Saturn: belts and the Great Red Spot,
 * rings and divisions, and the major moons. Ring radii are RETRIEVED (NASA
 * ring fact sheet); moon sizes and orbits from JPL Horizons; belt latitudes
 * are typical values (ESTIMATED: they vary from year to year).
 */
import type { Companion, ExplorerObject, LearnSection, Property, RingFeature, SurfaceFeature } from "./types";

const p = (label: string, value: string, kind: Property["kind"], sourceIds: string[], note?: string): Property => ({
  label,
  value,
  kind,
  sourceIds,
  ...(note ? { note } : {}),
});

const KM_PER_DEG_JUPITER = (Math.PI * 71_492) / 180;

const band = (
  id: string,
  name: string,
  latDeg: number,
  widthDeg: number,
  summary: string,
  facts: string[],
  related: string[],
): SurfaceFeature => ({
  id,
  name,
  type: "Band",
  latDeg,
  lonDeg: 0,
  longitude: "central-meridian",
  diameterKm: Math.round(widthDeg * KM_PER_DEG_JUPITER),
  nameOrigin: "",
  gazetteerUrl: "",
  priority: 1,
  terrain: false,
  summary,
  facts,
  properties: [
    p("Typical latitude", `${Math.abs(latDeg)}° ${latDeg >= 0 ? "N" : "S"} (centre)`, "estimated", ["rogers1995"], "Belt edges shift from year to year."),
    p("Typical width", `≈ ${Math.round((widthDeg * KM_PER_DEG_JUPITER) / 1000) * 1000} km`, "estimated", ["rogers1995"]),
  ],
  learn: [],
  related,
  sourceIds: ["rogers1995", "nasaJupiter"],
});

const JUPITER_FEATURES: SurfaceFeature[] = [
  {
    id: "great-red-spot",
    name: "Great Red Spot",
    type: "Storm",
    latDeg: -22,
    lonDeg: 0,
    longitude: "grs",
    diameterKm: 16_000,
    nameOrigin: "",
    gazetteerUrl: "",
    priority: 1,
    terrain: false,
    summary: "A giant anticyclone in Jupiter's southern hemisphere, larger than Earth.",
    facts: [
      "It has been watched continuously since at least the 1830s.",
      "It has shrunk from about 40,000 km across in the late 1800s to about 16,000 km.",
      "It drifts slowly in longitude, so its position has to be measured, not predicted from theory.",
      "Its colour and contrast change: in some years it is pale and hard to see in a small telescope.",
    ],
    properties: [
      p("Width", "≈ 16,000 km (2018)", "retrieved", ["simon2018"], "It continues to shrink."),
      p("Latitude", "≈ 22° S", "retrieved", ["simon2018"]),
    ],
    learn: [
      {
        heading: "A storm that does not die",
        body: "The Great Red Spot is a high-pressure storm turning anticlockwise, squeezed between jet streams flowing in opposite directions. It may persist because it is so large and because there is no solid surface to slow it down.",
        sourceIds: ["nasaJupiter", "simon2018"],
      },
      {
        heading: "When can I see it?",
        body: "Jupiter spins in under ten hours, so the spot is on the Earth-facing side for about five hours at a time. It crosses the middle of the disc roughly every 9 h 56 min.",
        sourceIds: ["skyTelGrs"],
      },
    ],
    related: ["south-equatorial-belt", "south-temperate-belt"],
    sourceIds: ["simon2018", "skyTelGrs", "nasaJupiter"],
  },
  band("north-equatorial-belt", "North Equatorial Belt", 12, 10, "The darker belt just north of the equator, usually the most prominent on the planet.", ["Visible in almost any telescope.", "Dark 'barges' and bright plumes come and go along its edges."], ["equatorial-zone", "north-temperate-belt"]),
  band("south-equatorial-belt", "South Equatorial Belt", -14, 13, "The dark belt south of the equator; the Great Red Spot sits in a 'hollow' on its southern edge.", ["Every few years it fades almost completely, then revives in a dramatic outbreak."], ["great-red-spot", "equatorial-zone"]),
  band("equatorial-zone", "Equatorial Zone", 0, 14, "The bright zone along the equator, often crossed by festoons from the North Equatorial Belt.", ["Clouds here rotate faster (System I, about 9 h 50 min) than at higher latitudes."], ["north-equatorial-belt", "south-equatorial-belt"]),
  band("north-temperate-belt", "North Temperate Belt", 27, 6, "A thinner belt in the northern temperate latitudes.", ["Its southern edge carries one of the fastest jet streams on the planet."], ["north-equatorial-belt"]),
  band("south-temperate-belt", "South Temperate Belt", -30, 6, "A thinner belt south of the Great Red Spot.", ["Long-lived white ovals have formed and merged along it."], ["great-red-spot"]),
];

const moon = (
  id: string,
  name: string,
  planet: "Jupiter" | "Saturn",
  radiusKm: string,
  aKm: string,
  periodDays: string,
  summary: string,
  facts: string[],
  positionNote: string,
  extra: LearnSection[] = [],
): Companion => ({
  id,
  name,
  classification: planet === "Jupiter" ? "Galilean moon of Jupiter" : "Moon of Saturn",
  summary,
  facts,
  properties: [
    p("Mean radius", radiusKm, "retrieved", [planet === "Jupiter" ? "nasaJupiterFacts" : "horizons"]),
    p("Distance from " + planet, aKm, "retrieved", [planet === "Jupiter" ? "nasaJupiterFacts" : "horizons"], "Semi-major axis of its orbit."),
    p("Orbital period", periodDays, "retrieved", [planet === "Jupiter" ? "nasaJupiterFacts" : "horizons"]),
  ],
  learn: [
    {
      heading: "Seen from Earth",
      body: `Through a backyard telescope ${name} is a point of light. The explorer names it from its predicted position at this time (${positionNote}); its surface is far too small to resolve.`,
      sourceIds: [planet === "Jupiter" ? "meeus" : "horizons"],
    },
    ...extra,
  ],
  sourceIds: planet === "Jupiter" ? ["nasaJupiter", "nasaJupiterFacts", "meeus"] : ["nasaSaturn", "horizons"],
});

const GALILEAN_NOTE = "Meeus, Astronomical Algorithms ch. 44";
const SATURN_NOTE = "orbit fitted to JPL Horizons";

export const JUPITER: Omit<ExplorerObject, "id" | "targetId"> = {
  name: "Jupiter",
  classification: "Gas giant",
  summary: "The largest planet, a banded ball of hydrogen and helium with dozens of moons.",
  properties: [
    p("Equatorial radius", "71,492 km", "retrieved", ["nasaJupiterFacts"]),
    p("Mass", "1.898 × 10²⁷ kg", "retrieved", ["nasaJupiterFacts"]),
    p("Rotation", "9.93 hours", "retrieved", ["nasaJupiterFacts"]),
  ],
  facts: [
    "Its fast spin flattens it visibly at the poles.",
    "The dark belts and light zones are bands of cloud moving at different speeds.",
    "Its four largest moons were discovered by Galileo in 1610.",
  ],
  learn: [
    {
      heading: "Belts and zones",
      body: "Light zones are regions of rising gas topped by high ammonia-ice clouds; dark belts are where gas sinks and deeper, darker clouds show through. Jet streams run along their edges.",
      sourceIds: ["nasaJupiter", "rogers1995"],
    },
    {
      heading: "The Galilean moons",
      body: "Io, Europa, Ganymede and Callisto change position every night. Io takes under two days to orbit and Callisto more than two weeks, so you can watch them move over a few hours.",
      sourceIds: ["nasaJupiter"],
    },
  ],
  sourceIds: ["nasaJupiter", "nasaJupiterFacts"],
  identifiable: "satellites",
  visualizations: ["planet3d", "orbits"],
  features: JUPITER_FEATURES,
  companions: [
    moon("io", "Io", "Jupiter", "1,821.6 km", "421,800 km", "1.769 days", "The most volcanically active world in the Solar System.", ["Tidal heating from Jupiter drives hundreds of active volcanoes."], GALILEAN_NOTE),
    moon("europa", "Europa", "Jupiter", "1,560.8 km", "671,100 km", "3.551 days", "An icy moon with a likely salty ocean beneath its crust.", ["One of the best places to look for environments suitable for life."], GALILEAN_NOTE),
    moon("ganymede", "Ganymede", "Jupiter", "2,631.2 km", "1,070,400 km", "7.155 days", "The largest moon in the Solar System, bigger than Mercury.", ["The only moon known to have its own magnetic field."], GALILEAN_NOTE),
    moon("callisto", "Callisto", "Jupiter", "2,410.3 km", "1,882,700 km", "16.689 days", "An ancient, heavily cratered icy moon.", ["Its surface is one of the most heavily cratered in the Solar System."], GALILEAN_NOTE),
  ],
  rings: [],
  projection: "jovian",
};

const ring = (
  id: string,
  name: string,
  type: RingFeature["type"],
  innerKm: number,
  outerKm: number,
  priority: RingFeature["priority"],
  summary: string,
  facts: string[],
  learn: LearnSection[] = [],
): RingFeature => ({
  id,
  name,
  type,
  innerKm,
  outerKm,
  priority,
  summary,
  facts,
  properties: [
    p("Distance from Saturn's centre", `${innerKm.toLocaleString("en-US")}–${outerKm.toLocaleString("en-US")} km`, "retrieved", ["nasaRingFacts"]),
    p("Width", `${(outerKm - innerKm).toLocaleString("en-US")} km`, "retrieved", ["nasaRingFacts"]),
  ],
  learn,
  sourceIds: ["nasaRingFacts", "nasaSaturn"],
});

export const SATURN_RINGS: RingFeature[] = [
  ring("c-ring", "C Ring", "Ring", 74_658, 92_000, 2, "The faint, translucent inner ring, also called the Crepe Ring.", ["Hard to see except where it crosses in front of the globe as a dusky band."]),
  ring("b-ring", "B Ring", "Ring", 92_000, 117_580, 1, "The broadest and brightest ring, and the most massive.", ["So densely packed with ice particles that it is almost opaque."]),
  ring("cassini-division", "Cassini Division", "Gap", 117_580, 122_170, 1, "The dark gap between the A and B rings, discovered by Giovanni Cassini in 1675.", [
    "Not empty: it holds sparser, darker ring material.",
    "Its inner edge is shaped by a resonance with the moon Mimas.",
    "Visible in small telescopes at the ends of the rings (the ansae) when the rings are well open and the seeing is steady.",
  ]),
  ring("a-ring", "A Ring", "Ring", 122_170, 136_775, 1, "The outer bright ring, beyond the Cassini Division.", ["Slightly darker than the B ring.", "Contains the narrow Encke and Keeler gaps."]),
  ring("encke-gap", "Encke Gap", "Gap", 133_423, 133_745, 3, "A narrow gap in the outer A ring, kept open by the small moon Pan.", ["Only 325 km wide: a challenge even for large telescopes in excellent seeing."]),
  ring("f-ring", "F Ring", "Ring", 140_080, 140_280, 3, "A narrow, braided ring just outside the A ring, herded by the moons Prometheus and Pandora.", ["Far too faint and thin to see from Earth with a backyard telescope."]),
];

export const SATURN: Omit<ExplorerObject, "id" | "targetId"> = {
  name: "Saturn",
  classification: "Gas giant",
  summary: "The ringed planet: a gas giant less dense than water, circled by a system of icy rings and dozens of moons.",
  properties: [
    p("Equatorial radius", "60,268 km", "retrieved", ["nasaSaturnFacts"]),
    p("Mass", "5.683 × 10²⁶ kg", "retrieved", ["nasaSaturnFacts"]),
    p("Rotation", "10.66 hours", "retrieved", ["nasaSaturnFacts"]),
    p("Rings' outer edge (A ring)", "136,775 km", "retrieved", ["nasaRingFacts"]),
  ],
  facts: [
    "The main rings are hundreds of thousands of kilometres across but typically only about 10 metres thick.",
    "We see the rings at a changing angle over Saturn's 29.5-year orbit; they turn edge-on twice per orbit (last in March 2025).",
    "Titan, its largest moon, is bigger than the planet Mercury.",
  ],
  learn: [
    {
      heading: "What the rings are",
      body: "The rings are countless pieces of almost pure water ice, from dust grains to house-sized blocks, each orbiting Saturn like a tiny moon. Gaps and edges are sculpted by the gravity of moons.",
      sourceIds: ["nasaSaturn"],
    },
    {
      heading: "Ring tilt",
      body: "Saturn's axis is tilted by about 27°, so as it orbits the Sun we see the rings from above, edge-on, then from below. The explorer calculates tonight's tilt; near edge-on the rings shrink to a line and the Cassini Division disappears.",
      sourceIds: ["nasaSaturn", "meeus"],
    },
  ],
  sourceIds: ["nasaSaturn", "nasaSaturnFacts", "nasaRingFacts"],
  identifiable: "satellites",
  visualizations: ["planet3d", "orbits"],
  features: [],
  rings: SATURN_RINGS,
  companions: [
    moon("titan", "Titan", "Saturn", "2,575.5 km", "1,221,870 km", "15.945 days", "Saturn's largest moon, with a thick nitrogen atmosphere and lakes of liquid methane.", [
      "The Huygens probe landed on Titan in January 2005.",
      "At magnitude 8–9 it is easy to see in any telescope.",
    ], SATURN_NOTE),
    moon("rhea", "Rhea", "Saturn", "764.5 km", "527,070 km", "4.518 days", "Saturn's second-largest moon, an icy, cratered world.", ["Usually the second-brightest of Saturn's moons in a telescope."], SATURN_NOTE),
    moon("iapetus", "Iapetus", "Saturn", "734.5 km", "3,560,840 km", "79.33 days", "A two-toned moon: one hemisphere is as dark as coal, the other bright as snow.", [
      "Because of this, it is several times brighter west of Saturn than east of it.",
      "Its far-out orbit is tilted to the rings, so it can appear well above or below them.",
    ], SATURN_NOTE),
    moon("dione", "Dione", "Saturn", "562.5 km", "377,420 km", "2.737 days", "An icy moon streaked with bright ice cliffs.", ["Shares its orbit with two tiny moons, Helene and Polydeuces."], SATURN_NOTE),
    moon("tethys", "Tethys", "Saturn", "536.3 km", "294,670 km", "1.888 days", "An icy moon with a huge crater, Odysseus, and a canyon that wraps three-quarters of the way around it.", ["Made almost entirely of water ice."], SATURN_NOTE),
    moon("enceladus", "Enceladus", "Saturn", "252.3 km", "238,040 km", "1.370 days", "A small icy moon that sprays water from a subsurface ocean out of its south pole.", [
      "Its geysers feed Saturn's faint E ring.",
      "One of the most promising places to look for life beyond Earth.",
    ], SATURN_NOTE),
    moon("mimas", "Mimas", "Saturn", "198.8 km", "185,540 km", "0.942 days", "A small moon dominated by one giant crater, Herschel.", ["Its gravity shapes the inner edge of the Cassini Division.", "At magnitude 13 and close to the bright rings, it is hard to see."], SATURN_NOTE),
    moon("hyperion", "Hyperion", "Saturn", "133 km (irregular)", "1,500,933 km", "21.28 days", "A sponge-like, irregular moon that tumbles chaotically.", ["Its orbit is disturbed by Titan, so its position here is approximate (to a few thousand km)."], SATURN_NOTE),
  ],
  projection: undefined,
};
