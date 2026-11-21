/**
 * Hand-written context for deep-sky features. Positions, magnitudes,
 * spectral types and parallaxes come from SIMBAD (features.json); this adds
 * what they are and why they matter, with sources.
 */
export interface DeepSkyContent {
  summary: string;
  facts: string[];
  /** Overrides the magnitude-based visibility note (e.g. hidden by dust). */
  visibility?: { title: string; body: string };
  related?: string[];
  sourceIds: string[];
}

export const DEEP_SKY_CONTENT: Record<string, DeepSkyContent> = {
  trapezium: {
    summary: "A tight, very young star cluster at the heart of the Orion Nebula.",
    facts: ["Its four brightest stars form the 'Trapezium', easy to split in a small telescope.", "Their ultraviolet light makes the surrounding gas glow."],
    related: ["theta1-ori-c", "orion-bar"],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  "theta1-ori-c": {
    summary: "The brightest and most massive star of the Trapezium.",
    facts: ["Its fierce ultraviolet light ionises most of the Orion Nebula."],
    related: ["trapezium"],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  m43: {
    summary: "A small, round glowing cloud just north of the main nebula, separated from it by a dark lane of dust.",
    facts: ["Lit by a single young star, NU Orionis.", "Shaped like a comma in photographs."],
    related: ["running-man", "trapezium"],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  "orion-bar": {
    summary: "A bright ridge where starlight from the Trapezium eats into the dense cloud behind the nebula.",
    facts: ["A textbook 'photo-dissociation region', studied in detail by the James Webb Space Telescope in 2022."],
    related: ["trapezium"],
    sourceIds: ["simbad"],
  },
  "orion-kl": {
    summary: "A cluster of massive stars being born behind the nebula, buried in dust.",
    facts: ["Seen only in infrared and radio light.", "About 500 years ago a close encounter of young stars set off an explosive outflow here."],
    visibility: { title: "Hidden by dust: not visible in any optical telescope", body: "It is marked from its catalogued position; its light reaches us only in infrared and radio." },
    related: ["trapezium"],
    sourceIds: ["simbad"],
  },
  "running-man": {
    summary: "A fainter glowing and reflecting cloud north of the Orion Nebula, named for the figure its dark lanes suggest in photographs.",
    facts: ["Best seen under dark skies; the 'running man' shape shows mainly in photographs."],
    related: ["m43"],
    sourceIds: ["simbad"],
  },
  "iota-ori": {
    summary: "The brightest star at the southern tip of Orion's Sword.",
    facts: ["A massive multiple star; a small telescope shows a close companion."],
    sourceIds: ["simbad"],
  },
  m32: {
    summary: "A small, compact elliptical galaxy orbiting the Andromeda Galaxy.",
    facts: ["Looks like a fuzzy star just south of Andromeda's core.", "Andromeda's gravity has probably stripped away its outer stars."],
    related: ["m110"],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  m110: {
    summary: "A larger, fainter dwarf elliptical galaxy orbiting Andromeda.",
    facts: ["An elongated glow north-west of Andromeda's core."],
    related: ["m32"],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  ngc206: {
    summary: "A huge cloud of young stars in Andromeda's disc.",
    facts: ["One of the few features inside another galaxy that amateur telescopes can pick out."],
    sourceIds: ["simbad"],
  },
  ngc604: {
    summary: "A giant star-forming nebula in the Triangulum Galaxy, one of the largest known.",
    facts: ["About 1,500 light-years across, far larger than the Orion Nebula.", "Visible as a small knot in medium telescopes under dark skies."],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  ngc5195: {
    summary: "The companion galaxy at the end of the Whirlpool's spiral arm.",
    facts: ["Its gravity has stirred the Whirlpool's spiral arms.", "The two galaxies are passing each other, and are joined by a bridge of stars."],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  ngc5461: { summary: "A giant star-forming region in the Pinwheel Galaxy's spiral arms.", facts: ["Bright enough to have its own NGC number."], related: ["ngc5462", "ngc5471"], sourceIds: ["simbad"] },
  ngc5462: { summary: "A giant star-forming region in the Pinwheel Galaxy.", facts: ["Close to NGC 5461 along the same spiral arm."], related: ["ngc5461"], sourceIds: ["simbad"] },
  ngc5471: { summary: "A giant star-forming region in the Pinwheel's outer disc.", facts: ["Seen as a detached knot east of the galaxy's main body."], related: ["ngc5461"], sourceIds: ["simbad"] },
  "m82-from-m81": {
    summary: "The Cigar Galaxy, a starburst galaxy close to M81 in the sky and in space.",
    facts: ["A close encounter with M81 triggered a burst of star formation.", "Fits in the same low-power field as M81."],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  "m81-from-m82": {
    summary: "Bode's Galaxy, a large spiral galaxy and M82's neighbour.",
    facts: ["The two have interacted, which set off M82's starburst."],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  alcyone: { summary: "The brightest star of the Pleiades.", facts: ["A hot blue giant and multiple star."], related: ["atlas", "merope"], sourceIds: ["simbad"] },
  atlas: { summary: "One of the Pleiades' brightest stars, named for the sisters' father in Greek myth.", facts: ["Sits at the east end of the cluster's 'dipper' with Pleione."], related: ["pleione"], sourceIds: ["simbad"] },
  electra: { summary: "One of the brighter of the Seven Sisters.", facts: ["Surrounded by faint reflection nebulosity in long exposures."], sourceIds: ["simbad"] },
  maia: { summary: "One of the Seven Sisters, with a faint reflection nebula around it.", facts: [], sourceIds: ["simbad"] },
  merope: {
    summary: "One of the Seven Sisters, lighting up the brightest part of the Pleiades' nebula.",
    facts: ["The Merope Nebula is dust that the cluster is passing through by chance, not its birth cloud."],
    related: ["merope-nebula"],
    sourceIds: ["simbad"],
  },
  taygeta: { summary: "One of the Seven Sisters.", facts: [], sourceIds: ["simbad"] },
  pleione: { summary: "The Pleiades' 'mother' in Greek myth: a rapidly spinning star whose brightness varies.", facts: ["Very close to Atlas, so the two are hard to separate by eye."], related: ["atlas"], sourceIds: ["simbad"] },
  celaeno: { summary: "One of the fainter named stars of the Pleiades.", facts: [], sourceIds: ["simbad"] },
  asterope: { summary: "A faint pair of stars (21 and 22 Tauri) in the Pleiades; 21 Tauri is shown here.", facts: [], sourceIds: ["simbad"] },
  "merope-nebula": {
    summary: "A reflection nebula: dust lit by Merope's blue light.",
    facts: ["Faint visually; it needs very dark skies and clean optics.", "SIMBAD lists only an approximate position for it."],
    related: ["merope"],
    sourceIds: ["simbad"],
  },
  "eps-cnc": { summary: "The brightest star in the Beehive Cluster.", facts: ["A white star about 600 light-years away, like the rest of the cluster."], sourceIds: ["simbad"] },
  "39-cnc": { summary: "A bright orange giant in the Beehive.", facts: ["One of the few yellow-orange stars among the cluster's white ones."], sourceIds: ["simbad"] },
  "40-cnc": { summary: "A white star in the Beehive's central group.", facts: [], sourceIds: ["simbad"] },
  "42-cnc": { summary: "A white star in the Beehive.", facts: [], sourceIds: ["simbad"] },
  ngc869: { summary: "The western half of the Double Cluster.", facts: ["A young open cluster about 7,500 light-years away.", "Its stars are only around 13 million years old."], related: ["ngc884"], sourceIds: ["simbad"] },
  ngc884: { summary: "The eastern half of the Double Cluster.", facts: ["Contains several red supergiants that stand out among its blue-white stars."], related: ["ngc869"], sourceIds: ["simbad"] },
  ngc6530: { summary: "The young star cluster inside the Lagoon Nebula.", facts: ["Born from the same cloud that still glows around it."], related: ["hourglass", "9-sgr"], sourceIds: ["simbad", "hubbleMessier"] },
  hourglass: { summary: "A small, bright patch in the Lagoon shaped like an hourglass in photographs.", facts: ["Lit by the massive young star Herschel 36."], related: ["herschel-36"], sourceIds: ["simbad"] },
  "herschel-36": { summary: "A massive young star that lights the Hourglass.", facts: [], related: ["hourglass"], sourceIds: ["simbad"] },
  "9-sgr": { summary: "A very hot, massive star whose light makes much of the Lagoon glow.", facts: [], related: ["ngc6530"], sourceIds: ["simbad"] },
  hd164492: { summary: "The multiple star at the centre of the Trifid Nebula, whose light makes it glow.", facts: ["Sits where the Trifid's dark lanes meet."], sourceIds: ["simbad"] },
  m21: { summary: "A young open cluster just north-east of the Trifid Nebula.", facts: ["Fits in the same low-power field as the Trifid."], sourceIds: ["simbad", "hubbleMessier"] },
  "crab-pulsar": {
    summary: "The spinning neutron star left by the supernova of 1054.",
    facts: ["It spins about 30 times a second.", "At about magnitude 16 it is beyond the reach of most backyard telescopes."],
    sourceIds: ["simbad", "hubbleMessier"],
  },
  ngc6207: { summary: "A spiral galaxy about half a degree from the Hercules Cluster, far beyond it.", facts: ["A faint smudge that shares the low-power field with M13."], sourceIds: ["simbad"] },
};
