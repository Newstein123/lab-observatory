# Astronomical Object Explorer

Identify what you see in the Telescope Lab's eyepiece or camera view, then explore it: properties, 3D models, maps, real imagery and context. All five MVP phases are built into the existing **Simulate** step. There is no new workflow step, and the simulation engine is unchanged.

- **Phase 1:** identification, pinning, the explorer panel.
- **Phase 2:** the Moon.
- **Phase 3:** Jupiter and Saturn.
- **Phase 4:** deep sky.
- **Phase 5:** Discoveries.

**Observe → Identify → Explore → Discover.**

## What the user sees

- **Observation toolbar** sits in the view card, next to Eyepiece/Camera:
  - **Identify**: click anything in the view. Hovering shows a name.
  - **Pin**: writes the selection to the URL as `?feature=`, so a link or reload reopens it.
  - **Labels**: names in the view, also under Layers → *Feature labels*.
  - **Explore**: opens the panel.
  - **Discoveries**: what you saved and recently explored on this target, plus a link to all discoveries.
- **What can be identified in the view.** Everything is placed from real coordinates:

  | Target | What is labelled |
  | --- | --- |
  | Moon | 43 IAU-named craters, maria, mountains and valleys, and the Apollo 11 site |
  | Jupiter | Belts and zones, the Great Red Spot, and the four Galilean moons |
  | Saturn | Rings and divisions (labelled at the ring ends when large enough to label), and eight moons |
  | Deep sky | Named stars, clusters, nebula regions and companion galaxies (41 objects across 15 targets) |

- **Explorer panel** replaces Results/Sky/Target in the right column (× returns to them). Its header has **Save** (to Discoveries) and **Pin**.
- **Explore more on …** is a strip under the view. Features in the field (and, for the Moon, lit) come first.
- **Discoveries page** (`/discoveries`, also in the top navigation):
  - Saved items grouped by target, with real-imagery thumbnails and editable notes.
  - "Observe" reopens an item in the Lab.
  - *Explore next* suggests related features not yet saved.
  - *Recently explored* is kept on this device only.

Tabs adapt to the selection (`src/modules/explorer/registry.ts`):

| Selection | Tabs |
| --- | --- |
| Lunar feature, or the Moon | Info · 3D Model (crater terrain / globe) · Surface Map · Learn |
| Jupiter or Saturn, or a belt, the Great Red Spot or a ring | Info · 3D Model (planet as seen now; moons' orbits) · Learn |
| A planet's moon | Info · 3D Model (orbits only: never a surface) · Learn |
| Deep-sky target or a feature in it | Info · Image (the real survey image) · Learn. Never a planetary surface map |
| Targets with no curated data (Venus, Mars…) | Info only, from the catalogue |

## Accuracy model (spec §9)

The explorer keeps three things apart.

1. **What the telescope resolves.** `classifyObservability` (`src/modules/explorer/identify.ts`) compares the angular size (real size ÷ the body's distance tonight) with the simulation's resolution, max(Dawes limit, seeing).
   - It also checks what the eye or sensor can use: about 1′ apparent size for the eye to see a feature at all and about 2′ to make out its shape; 2 camera pixels to detect it and 4 to resolve it.
   - The result is *resolved*, *at the limit* or *identified by position*.
   - **Rings** use their radial width at the ring ends. If the rings are within 3° of edge-on, they are shown as unresolvable.
   - **Moons and stars** use magnitude against the setup's limiting magnitude.
   - **Extended deep-sky objects** use their total magnitude, with a note that surface brightness matters.
2. **What is identified by position.** Every label and hit test comes from coordinates and the view's own sky-to-screen mapping (`geom.targetPx`, `panPx`, `orient()`):

   | Object | How its position is found |
   | --- | --- |
   | Moon features | IAU selenographic lat/lon, projected for the observation's libration and axis angle (Meeus ch. 53) |
   | Jupiter's belts and Great Red Spot | Planetographic latitude, plus the System II central meridian, sub-Earth latitude and pole angle (Meeus ch. 43) |
   | Galilean moons | Meeus ch. 44 |
   | Saturn's moons | Orbit models fitted to JPL Horizons, light time included |
   | Saturn's rings | Measured radii, the ring tilt B and the pole angle |
   | Deep-sky objects | SIMBAD J2000 positions, as tangent-plane offsets from the survey image's centre (which is the view's origin) |

   Planetary moons are always *identified by position, not resolved*.
   Orion KL is explicitly *hidden by dust: not visible in any optical telescope*.
3. **What is a separate scientific reconstruction.** Every 3D view carries an *Illustrative* badge and says what it is built from:
   - **Moon:** LOLA and LROC data.
   - **Jupiter:** the Cassini map of December 2000, whose clouds have changed since.
   - **Saturn:** measured ring radii with illustrative shading. The globe is left plain because no NASA global map exists.

   Any vertical exaggeration other than 1× shows an *Elevation exaggerated N×* badge, and the cross-section has a true-scale mode. The deep-sky Image tab labels the survey photograph as a long exposure, deeper and more colourful than the eye sees.

Provenance badges reuse the existing kinds:

| Kind | Meaning | Examples |
| --- | --- | --- |
| `retrieved` | Measured or catalogued by a cited source | Gazetteer and ring-sheet sizes, SIMBAD magnitudes, literature ages |
| `calculated` | Computed here | Crater depth from LOLA, libration, ring tilt, distances from parallax, central-meridian transit time |
| `estimated` | Approximate, with the reason stated | The Great Red Spot's longitude (drift model), Jupiter's belt latitudes (typical values), Hyperion's position |
| `illustrative` | Visualisations | 3D views, ring shading |

### The Great Red Spot

The Great Red Spot drifts in longitude, so it cannot be predicted from theory. Its System II longitude follows Sky & Telescope's published linear model (91° on 1 June 2026, +1.75°/month), labelled *estimated*. Sources disagree by several degrees; see `GRS_MODEL` in `src/modules/sky/jupiter.ts`.

In the Info tab, the user can enter a measured longitude (e.g. from JUPOS). It is saved on the device (`ue.grs.v1`) and carried forward at the drift rate, and the value is then shown as *calculated*. The Info tab also gives the next central-meridian transit time.

The Cassini map was aligned by locating the spot in the image automatically (the reddest patch at 15–30° S), so the 3D globe shows it at the same longitude as the labels.

## How positions line up with the drawn Moon

The eyepiece Moon is made from the LRO WAC global mosaic, not a fixed photograph:

1. **Orientation.** `moonOrientation` (`src/modules/sky/moon.ts`) gives libration, the axis angle P and the sub-solar point, checked against Meeus 53.a: l and b within 0.03°, P within 0.01°.
2. **Drawing the disc.** `projectMoonDisc` projects the map for that libration. The view turns the disc by P.
3. **Placing labels.** Labels use the same formulas (`projectSelenographic`). A test checks that a drawn feature falls within about 1.5 px of its label.
4. **Caching and fallback.** `useMoonDisc` caches the projected disc by libration and resolution tier, and falls back to the photograph while loading.

## Saturn's moons

`scripts/fetch-planet-data.mjs` fetches 24,000 Saturn-centred state vectors per moon (2022–2032, sat441) from JPL Horizons. It then fits piecewise mean-orbit models:
- yearly segments for most moons;
- 15-day segments for Mimas, whose orbit's long axis turns about once a year;
- 30-day segments for Hyperion, which is chaotic and in resonance with Titan;
- 2-year segments for Iapetus.

Fit residuals are under 525 km for all but Hyperion (rms about 1,900 km). `saturn-moons.test.ts` checks sky positions against Horizons' own astrometric positions on three dates. The worst errors are 0.05–0.25″, Iapetus 1.1″ and Hyperion 0.1″. The model data (270 kB) loads only when Saturn is shown, and is valid within the fitted span.

## Architecture

| Spec component | Implementation |
| --- | --- |
| AstronomicalObjectExplorer | Wiring in `src/components/lab/lab-workspace.tsx` |
| ObjectSelection | `src/modules/explorer/identify.ts` (`placeFeatures`, `featureAt`, `chooseLabels`, `placeRings`, `ringAt`), `identifyAt` in `feature-layer.tsx` |
| Surface geometry (shared by view, panel and strip) | `src/modules/explorer/projection.ts` (`surfaceGeometry`: selenographic, Jovian, equatorial, rings) |
| FeatureAnnotationLayer | `src/components/explorer/feature-layer.tsx`, inside `SimulationViewport` |
| ObjectInformationPanel | `object-explorer-panel.tsx`, `object-info-tab.tsx`, `planet-info.tsx`, `deep-sky-info.tsx`, `learn-tab.tsx` |
| ObjectVisualizationEngine | `src/modules/explorer/registry.ts` plus `ExplorerObject.visualizations` |
| Object3DRenderer | `globe-scene.tsx`, `terrain-scene.tsx`, `planet-scene.tsx` (react-three-fiber, lazy-loaded) |
| SurfaceMapViewer | `surface-map.tsx` |
| AstronomicalImageViewer | `sky-image-viewer.tsx` (deep sky), terrain *Image* view (Moon) |
| ScientificDataService | `src/modules/explorer/objects.ts`, `planets.ts`, `lunar/*`, `deep-sky/*`, `terrain.ts`, `src/modules/targets/saturn-moons.ts` |
| DiscoveryManager | `src/modules/discoveries/*` (model, hooks, history), `ObservatoryRepository` discovery methods, `src/components/discoveries/discoveries-page.tsx`, `discoveries-button.tsx` |

### Data and assets

Object metadata and visualisation assets are stored separately. Every asset has a manifest entry giving its source, processing and kind.

| Data | Where | Source |
| --- | --- | --- |
| Lunar names, positions, sizes | `explorer/lunar/features.json` | IAU/USGS Gazetteer |
| Lunar maps and elevation | `public/explorer/moon/*`, `lunar/assets.json` | NASA SVS CGI Moon Kit (LROC WAC, LOLA); USGS LOLA 118 m and WAC 100 m crops |
| Saturn moon models and checks | `explorer/saturn/moons.json`, `moons.check.json` | JPL Horizons |
| Jupiter map | `public/explorer/jupiter/map-2k.webp`, `jupiter/assets.json` | NASA Photojournal PIA07782 (Cassini) |
| Deep-sky objects | `explorer/deep-sky/features.json` | SIMBAD (positions, types, V magnitudes, sizes, parallaxes, spectral types) |
| Text and properties | `lunar/content.ts`, `planets.ts`, `deep-sky/content.ts` | Cited per entry from `explorer/sources.ts` |

### Refreshing the data

```sh
node scripts/fetch-lunar-data.mjs [--force] [--only=features,albedo,elevation,terrain:tycho]
node scripts/fetch-planet-data.mjs [--only=saturn-moons,jupiter-map]
node scripts/fetch-deep-sky.mjs
```

- **Lunar data:** USGS rasters are read with HTTP range requests (via the `geotiff` devDependency).
- **Saturn's moons:** the Saturn moon fit must be refreshed before 2032.
- **Deep sky:** the script uses SIMBAD's CfA mirror. It drops any object that falls outside its target's survey image and aborts if a name doesn't resolve.

## Discoveries (Phase 5)

- **Model** (`src/modules/discoveries/models.ts`):
  - A discovery is a target, a kind (object, feature, companion or ring) and a feature id, plus the name, an optional note, and when, where and with what setup it was saved.
  - There is one record per thing per user: saving again returns the existing record.
- **Repository:**
  - `ObservatoryRepository` has `listDiscoveries`, `createDiscovery`, `updateDiscoveryNote` and `deleteDiscovery`, covered by `repository.contract.ts` for both backends.
  - **Local:** the storage document is upgraded to schema v3 (v1 and v2 documents are upgraded in place).
  - **Supabase:** migration `20261121120000_discoveries.sql` adds an owner-only row-level-security table, a unique index per owner and thing, and a check that only "object" has no feature id.
  - `supabase-repository.test.ts` adds a privacy test: another user can't see or change a discovery.
- **Signed out:** with accounts enabled, the panel shows *Sign in to save* and the page asks to sign in.
- **History:** recently explored items are kept in `localStorage` (`ue.explored.v1`, 30 items) and are never sent to the server.

## Adding an object

1. Add an `ExplorerObject` to `CURATED` in `src/modules/explorer/objects.ts` (or in `planets.ts`). Give every property `kind` and `sourceIds`. List only `visualizations` that have real data behind them.
2. **Surface features:** set `projection` and add a projector in `projection.ts` if it is a new kind of body.
3. **Deep-sky features:** add SIMBAD-resolvable names to `CURATED` in `scripts/fetch-deep-sky.mjs`, plus text in `deep-sky/content.ts`.
4. **Moons:** positions must come from an ephemeris (`src/modules/targets/satellites.ts`).
5. The registry and panel adapt automatically. Add a tab test to `explorer.test.ts`.

## Not yet covered

- Saturn's globe has no surface map (no NASA global map exists), so its belts aren't identifiable.
- Ring labels appear only when the rings are large on screen.
- Moon shadows and transits on Jupiter aren't drawn.
- Saved discoveries don't yet link to saved simulation sessions or observation projects.

## Tests

- **Unit** (`pnpm test`):

  | File | What it checks |
  | --- | --- |
  | `src/modules/sky/lunar-orientation.test.ts` | Meeus 53.a |
  | `src/modules/sky/jupiter.test.ts` | Meeus 43.a, and Horizons' pole angle |
  | `src/modules/targets/saturn-moons.test.ts` | 24 Horizons astrometric checks |
  | `src/modules/simulations/renderers/moon-projection.test.ts` | Drawn feature = label position |
  | `src/modules/explorer/explorer.test.ts` | Hit tests, labels, observability, tabs, sources, rings, Jupiter transit, deep-sky offsets and distances |
  | `src/modules/explorer/terrain.test.ts` | Crater measurements |
  | `src/modules/persistence/repository.contract.ts` | Discoveries, run for both backends |

- **Database** (`pnpm test:db`, needs local Supabase): the full contract, plus the discovery privacy test.
- **End-to-end** (`e2e/explorer.spec.ts`):
  - **Moon:** labels and Identify, plus Tycho's measured facts, reconstruction badges and pinning.
  - **Planets:** Jupiter's moons are identified by position; the Great Red Spot uses the estimated model or a measured value; Saturn's rings and moons appear, and the orbit view renders without console errors.
  - **Deep sky:** Orion's regions on the survey image; Pleiades magnitudes and distances.
  - **Discoveries:** saving, notes, *Explore next*, history and removing; plus the signed-out prompt.
