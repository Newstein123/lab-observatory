/**
 * Hand-curated science for the lunar landmarks. Positions and sizes come from
 * the Gazetteer (features.json); this file adds the explanation. Every value
 * and section names its sources; dated values are RETRIEVED from the cited
 * literature (sample-based ages are inferred from returned samples, as noted).
 * Features without an entry here show only Gazetteer data.
 */
import type { LearnSection, Property } from "../types";

export interface FeatureContent {
  summary: string;
  facts: string[];
  properties?: Property[];
  learn?: LearnSection[];
  related?: string[];
  sourceIds: string[];
}

export const LUNAR_CONTENT: Record<string, FeatureContent> = {
  tycho: {
    summary: "A young, sharp impact crater whose bright rays stretch across much of the near side.",
    facts: [
      "One of the youngest large craters on the Moon.",
      "Its bright ray system is best seen around full Moon.",
      "Has terraced walls and a central peak.",
      "Surveyor 7 landed on its northern ejecta blanket in January 1968.",
    ],
    properties: [
      {
        label: "Estimated age",
        value: "≈ 108 million years",
        kind: "retrieved",
        sourceIds: ["wilhelms1987"],
        note: "Inferred from Apollo 17 samples thought to be Tycho ejecta (exposure ages).",
      },
    ],
    learn: [
      {
        heading: "Formation",
        body: "An asteroid impact excavated the crater and threw out fresh, bright material. Debris from the impact made the rays, and some of it may have triggered the landslide sampled by Apollo 17, about 2,000 km away.",
        sourceIds: ["wilhelms1987", "apollo"],
      },
      {
        heading: "Why it looks so bright",
        body: "Exposure to space slowly darkens lunar soil. Tycho's rays are young enough that they have not darkened yet, so they stand out against the older surface, most of all when the Sun is high.",
        sourceIds: ["nasaMoon", "lroc"],
      },
    ],
    related: ["clavius", "mare-nubium", "copernicus"],
    sourceIds: ["gazetteer", "wilhelms1987", "lroc"],
  },
  copernicus: {
    summary: "A large young crater with terraced walls, central peaks and a bright ray system.",
    facts: [
      "Its name labels the Copernican period, the most recent era of lunar history.",
      "Has terraced inner walls and several central peaks.",
      "Its rays and secondary craters spread across Oceanus Procellarum and Mare Imbrium.",
    ],
    properties: [
      {
        label: "Estimated age",
        value: "≈ 800 million years",
        kind: "retrieved",
        sourceIds: ["wilhelms1987"],
        note: "Inferred from Apollo 12 samples of ray material.",
      },
    ],
    learn: [
      {
        heading: "Complex craters",
        body: "Impacts this large leave a crater that cannot hold its shape. The walls slump into terraces and the floor rebounds into central peaks. Copernicus is a textbook example.",
        sourceIds: ["wilhelms1987"],
      },
    ],
    related: ["eratosthenes", "kepler", "montes-carpatus", "mare-imbrium"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  plato: {
    summary: "A walled plain whose floor was flooded by dark lava, on the northern shore of Mare Imbrium.",
    facts: [
      "Its smooth dark floor stands out against the bright highlands around it.",
      "Formed after the Imbrium basin, then filled with mare basalt.",
      "Small craterlets on its floor are a classic test of seeing and optics.",
    ],
    related: ["montes-alpes", "vallis-alpes", "mare-imbrium", "mons-pico"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  aristarchus: {
    summary: "The brightest large crater on the Moon, on a raised volcanic plateau.",
    facts: [
      "So bright that it can be seen on the earthshine-lit part of the Moon.",
      "Sits next to Vallis Schröteri, the largest sinuous rille.",
      "The plateau around it is covered by dark volcanic ash deposits.",
    ],
    related: ["vallis-schroteri", "oceanus-procellarum", "kepler"],
    sourceIds: ["gazetteer", "lroc", "nasaMoon"],
  },
  kepler: {
    summary: "A small, young crater with a bright ray system in Oceanus Procellarum.",
    facts: ["Its rays reach out to meet those of Copernicus.", "Best seen near full Moon, when the rays dominate."],
    related: ["copernicus", "aristarchus", "oceanus-procellarum"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  clavius: {
    summary: "One of the largest craters on the near side, with an arc of smaller craters across its floor.",
    facts: [
      "The craters on its floor shrink steadily in size, making an easy-to-see curve.",
      "In 2020 NASA's SOFIA airborne observatory detected molecular water in sunlit soil here.",
      "Near the southern limb, so it appears foreshortened into an oval.",
    ],
    related: ["tycho", "mare-nubium"],
    sourceIds: ["gazetteer", "sofiaClavius"],
  },
  theophilus: {
    summary: "A deep crater with a large central peak complex on the edge of Mare Nectaris.",
    facts: [
      "It cuts into the older crater Cyrillus, which shows it is the younger of the two.",
      "Theophilus, Cyrillus and Catharina make a striking chain near the terminator about five days after new Moon.",
    ],
    related: ["cyrillus", "catharina", "mare-nectaris"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  cyrillus: {
    summary: "An old, eroded crater partly overlain by Theophilus.",
    facts: ["Its softened walls show it is much older than Theophilus."],
    related: ["theophilus", "catharina"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  catharina: {
    summary: "A heavily eroded crater, the oldest of the Theophilus–Cyrillus–Catharina chain.",
    facts: ["Later impacts have broken its rim and floor."],
    related: ["theophilus", "cyrillus"],
    sourceIds: ["gazetteer"],
  },
  ptolemaeus: {
    summary: "A large walled plain with a flat, lava-filled floor near the centre of the near side.",
    facts: ["Forms a north–south chain with Alphonsus and Arzachel.", "Its shallow floor shows low hills only when the Sun is low."],
    related: ["alphonsus", "arzachel", "sinus-medii"],
    sourceIds: ["gazetteer"],
  },
  alphonsus: {
    summary: "A crater with a central peak and small dark volcanic deposits on its floor.",
    facts: ["NASA's Ranger 9 sent back close-up pictures as it crashed here in March 1965."],
    related: ["ptolemaeus", "arzachel"],
    sourceIds: ["gazetteer", "nasaMoon"],
  },
  arzachel: {
    summary: "A sharp crater with terraced walls and an off-centre central peak.",
    facts: ["The southern member of the Ptolemaeus–Alphonsus–Arzachel chain."],
    related: ["alphonsus", "ptolemaeus", "rupes-recta"],
    sourceIds: ["gazetteer"],
  },
  langrenus: {
    summary: "A prominent crater with terraced walls and central peaks on the eastern edge of Mare Fecunditatis.",
    facts: ["Best seen a few days after new Moon or just after full Moon, when shadows fill it."],
    related: ["petavius", "mare-fecunditatis"],
    sourceIds: ["gazetteer"],
  },
  petavius: {
    summary: "A large crater with a raised, fractured floor and a rille running from its central peak to the wall.",
    facts: ["Its floor was pushed up and cracked from below, probably by magma."],
    related: ["langrenus", "mare-fecunditatis"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  grimaldi: {
    summary: "A dark-floored basin near the western limb, one of the darkest spots on the near side.",
    facts: ["Easy to find even through small binoculars because its floor is so dark."],
    related: ["oceanus-procellarum"],
    sourceIds: ["gazetteer"],
  },
  posidonius: {
    summary: "A lava-flooded crater with rilles across its floor, on the north-eastern edge of Mare Serenitatis.",
    facts: ["Its floor is crossed by a network of rilles, visible when the Sun is low."],
    related: ["mare-serenitatis"],
    sourceIds: ["gazetteer"],
  },
  archimedes: {
    summary: "A large crater in Mare Imbrium whose floor is filled with lava.",
    facts: ["Formed after the Imbrium basin, then flooded with the same lavas that filled the mare."],
    related: ["mare-imbrium", "montes-apenninus", "plato"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  eratosthenes: {
    summary: "A deep crater at the end of the Apennine mountains. It gives its name to the Eratosthenian period.",
    facts: [
      "Older than Copernicus, so its rays have faded and it looks darker.",
      "Marks the western end of Montes Apenninus.",
    ],
    related: ["copernicus", "montes-apenninus"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  gassendi: {
    summary: "A crater with a cracked, uplifted floor on the northern shore of Mare Humorum.",
    facts: ["Was considered as a landing site for Apollo 16.", "Its fractured floor is a sign of magma rising beneath it."],
    related: ["mare-humorum", "schickard"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  schickard: {
    summary: "A very large, shallow crater near the south-western limb with patches of dark lava.",
    facts: ["Seen almost edge-on from Earth, so it looks strongly oval."],
    related: ["gassendi", "mare-humorum"],
    sourceIds: ["gazetteer"],
  },
  "mare-imbrium": {
    summary: "A vast lava plain filling one of the Moon's largest impact basins.",
    facts: [
      "The Imbrium basin formed about 3.9 billion years ago.",
      "Dark basalt lavas later filled it over hundreds of millions of years.",
      "Its rim includes Montes Apenninus, Montes Carpatus and Montes Alpes.",
      "Apollo 15 landed on its eastern edge in 1971.",
    ],
    properties: [
      { label: "Basin age", value: "≈ 3.9 billion years", kind: "retrieved", sourceIds: ["wilhelms1987"] },
    ],
    learn: [
      {
        heading: "Basins and maria",
        body: "Giant impacts dug basins hundreds of kilometres across. Much later, molten rock from deep inside the Moon rose and flooded them, making the dark, smooth maria we see by eye.",
        sourceIds: ["wilhelms1987", "nasaMoon"],
      },
    ],
    related: ["montes-apenninus", "plato", "copernicus", "sinus-iridum", "archimedes"],
    sourceIds: ["gazetteer", "wilhelms1987", "apollo"],
  },
  "mare-tranquillitatis": {
    summary: "The Sea of Tranquility, where people first walked on the Moon.",
    facts: [
      "Apollo 11 landed here on 20 July 1969.",
      "Its basalts are rich in titanium, which gives the mare a slightly bluish tint in colour images.",
    ],
    related: ["statio-tranquillitatis", "mare-serenitatis", "mare-crisium"],
    sourceIds: ["gazetteer", "apollo", "lroc"],
  },
  "mare-serenitatis": {
    summary: "The Sea of Serenity, a round mare in the north-east of the near side.",
    facts: [
      "Apollo 17, the last crewed Moon landing, touched down at its south-eastern edge in 1972.",
      "Its darker rim and lighter centre show lavas of different composition and age.",
    ],
    related: ["mare-tranquillitatis", "posidonius", "montes-caucasus"],
    sourceIds: ["gazetteer", "apollo", "wilhelms1987"],
  },
  "mare-crisium": {
    summary: "The Sea of Crises, an isolated round mare near the eastern limb.",
    facts: [
      "The Soviet Luna 24 probe returned samples from here in 1976.",
      "Libration makes it look wider or narrower from night to night.",
    ],
    related: ["mare-tranquillitatis", "langrenus"],
    sourceIds: ["gazetteer", "nasaMoon"],
  },
  "oceanus-procellarum": {
    summary: "The Ocean of Storms, the largest dark lava plain on the Moon.",
    facts: [
      "Apollo 12 landed here in 1969, next to the Surveyor 3 probe.",
      "China's Chang'e 5 returned some of the youngest lunar lava samples from here in 2020.",
    ],
    related: ["kepler", "aristarchus", "grimaldi", "copernicus"],
    sourceIds: ["gazetteer", "apollo", "nasaMoon"],
  },
  "mare-fecunditatis": {
    summary: "The Sea of Fertility, a mare on the eastern side of the near side.",
    facts: ["The Soviet Luna 16 probe returned the first robotic lunar samples from here in 1970."],
    related: ["langrenus", "petavius", "mare-nectaris"],
    sourceIds: ["gazetteer", "nasaMoon"],
  },
  "mare-nectaris": {
    summary: "The Sea of Nectar, a small mare filling one of the older large basins.",
    facts: ["Its basin gives its name to the Nectarian period of lunar history."],
    related: ["theophilus", "mare-fecunditatis"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  "mare-nubium": {
    summary: "The Sea of Clouds, a mare in the south-central near side.",
    facts: ["Rupes Recta, the Straight Wall, runs across its eastern part."],
    related: ["rupes-recta", "tycho", "mare-humorum"],
    sourceIds: ["gazetteer"],
  },
  "mare-humorum": {
    summary: "The Sea of Moisture, a round mare in the south-west.",
    facts: ["Rilles curve around its edges, where the lava-filled basin floor sagged."],
    related: ["gassendi", "mare-nubium", "schickard"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  "mare-frigoris": {
    summary: "The Sea of Cold, a long thin mare across the far north of the near side.",
    facts: ["Stretches east–west north of Plato and Mare Imbrium."],
    related: ["plato", "montes-alpes"],
    sourceIds: ["gazetteer"],
  },
  "mare-vaporum": {
    summary: "The Sea of Vapours, a small mare south of Montes Apenninus.",
    facts: ["Lies between Mare Imbrium and Sinus Medii."],
    related: ["montes-apenninus", "sinus-medii"],
    sourceIds: ["gazetteer"],
  },
  "sinus-iridum": {
    summary: "The Bay of Rainbows, a lava-flooded half crater on the edge of Mare Imbrium.",
    facts: [
      "When the terminator lies just west of it, the Jura mountains around it catch the sunlight first. This is the 'jewelled handle'.",
    ],
    related: ["mare-imbrium", "plato"],
    sourceIds: ["gazetteer"],
  },
  "sinus-medii": {
    summary: "The Bay of the Centre, the point nearest to Earth on the Moon's face.",
    facts: ["NASA's Surveyor 6 landed here in 1967."],
    related: ["ptolemaeus", "mare-vaporum"],
    sourceIds: ["gazetteer", "nasaMoon"],
  },
  "montes-apenninus": {
    summary: "The Apennines, a 600 km arc of mountains on the south-eastern rim of the Imbrium basin.",
    facts: [
      "The mountains are blocks of crust thrown up by the Imbrium impact.",
      "Apollo 15 landed at their foot, by Hadley Rille, in 1971.",
      "Their long shadows are spectacular about a week after new Moon.",
    ],
    related: ["mare-imbrium", "eratosthenes", "archimedes", "montes-caucasus"],
    sourceIds: ["gazetteer", "apollo", "wilhelms1987"],
  },
  "montes-alpes": {
    summary: "The Alps, mountains on the north-eastern rim of the Imbrium basin, cut by the Alpine Valley.",
    facts: ["Formed by the Imbrium impact, like the Apennines."],
    related: ["vallis-alpes", "plato", "mare-imbrium"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  "montes-caucasus": {
    summary: "The Caucasus, mountains between Mare Imbrium and Mare Serenitatis.",
    facts: ["Continue the Apennine arc to the north-east."],
    related: ["montes-apenninus", "mare-serenitatis"],
    sourceIds: ["gazetteer"],
  },
  "montes-carpatus": {
    summary: "The Carpathians, low mountains on the southern rim of the Imbrium basin.",
    facts: ["Lie just north of Copernicus."],
    related: ["copernicus", "mare-imbrium"],
    sourceIds: ["gazetteer"],
  },
  "mons-piton": {
    summary: "An isolated mountain rising from Mare Imbrium.",
    facts: ["Probably a peak of the Imbrium basin's inner ring, left standing above the lava.", "Casts a long shadow near the terminator."],
    related: ["mons-pico", "mare-imbrium"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  "mons-pico": {
    summary: "An isolated mountain in Mare Imbrium, south of Plato.",
    facts: ["Probably part of the Imbrium basin's buried inner ring."],
    related: ["plato", "mons-piton"],
    sourceIds: ["gazetteer", "wilhelms1987"],
  },
  "vallis-alpes": {
    summary: "The Alpine Valley, a straight valley cutting through the lunar Alps.",
    facts: ["A thin rille winds along its floor, a test for good seeing and a larger telescope."],
    related: ["montes-alpes", "plato"],
    sourceIds: ["gazetteer", "lroc"],
  },
  "vallis-schroteri": {
    summary: "Schröter's Valley, the largest sinuous rille on the Moon.",
    facts: ["Carved by flowing lava. It starts at the 'Cobra Head' and winds across the Aristarchus plateau."],
    related: ["aristarchus", "oceanus-procellarum"],
    sourceIds: ["gazetteer", "lroc"],
  },
  "rupes-recta": {
    summary: "The Straight Wall, a fault in Mare Nubium.",
    facts: [
      "Shows as a dark line a little after first quarter, when it casts a shadow.",
      "Shows as a bright line near last quarter, when sunlight hits its face.",
      "Its slope is gentle; it only looks like a cliff because of the shadows.",
    ],
    related: ["mare-nubium", "arzachel"],
    sourceIds: ["gazetteer", "lroc"],
  },
  "statio-tranquillitatis": {
    summary: "Tranquility Base, the Apollo 11 landing site.",
    facts: [
      "Neil Armstrong and Buzz Aldrin landed here on 20 July 1969.",
      "No telescope on Earth can see the hardware left behind; it is far below any telescope's resolution.",
    ],
    related: ["mare-tranquillitatis"],
    sourceIds: ["gazetteer", "apollo"],
  },
};

/** Generic one-liners from the IAU descriptor term, for features without curated text. */
export const TYPE_LABELS: Record<string, { label: string; plural: string; summary: string }> = {
  Crater: { label: "Impact crater", plural: "Craters", summary: "An impact crater." },
  Mare: { label: "Lunar mare", plural: "Maria", summary: "A plain of dark basalt lava." },
  Oceanus: { label: "Lunar mare", plural: "Maria", summary: "A very large plain of dark basalt lava." },
  Sinus: { label: "Bay", plural: "Bays", summary: "A small plain of dark lava, like a bay of a mare." },
  Montes: { label: "Mountain range", plural: "Mountains", summary: "A range of mountains." },
  Mons: { label: "Mountain", plural: "Mountains", summary: "A mountain." },
  Statio: { label: "Landing site", plural: "Landing sites", summary: "A spacecraft landing site." },
  Vallis: { label: "Valley", plural: "Valleys", summary: "A valley." },
  Rupes: { label: "Scarp", plural: "Scarps", summary: "A scarp, or cliff." },
};
