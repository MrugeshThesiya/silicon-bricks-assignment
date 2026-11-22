# Bangkok Plot Planner

A browser tool for a developer who owns a plot in Bangkok and wants to know what they can build on it before paying an architect. The user draws a plot on a map, and the tool shows the zoning rules that apply, the 3D space the building may fill, and concept designs that fit, each with a pass/fail checklist.

**Live demo:** https://building-planner-app.pages.dev/ (Cloudflare Pages, static).

**Status:** working prototype. Press **Example plot** for a ready-made corner plot on Sukhumvit Road and Soi 95 (its zone, road widths and station distance are estimates), or draw a plot (any shape), pick the zone type, the road edge and its width, and say what the other sides border (neighbour, another road, or a canal). The tool shows the rules that apply, the space allowed under 23 m and for a high-rise (with the road height limit as a stepped slope), and concept designs, each with a pass/fail checklist that cites rule IDs. Five building types are offered: condominium, hotel, office, mixed use (shops below, condominium above) and shophouse / townhouse rows. The limits for each come from the plan's "prohibited unless" lists (hotel rooms, office and shop floor area, housing over 10,000 m²) and MR 55 for row houses; see `docs/zoning-rules.md` section 4b. Existing OSM buildings on the plot are hidden by default (the plot is treated as an empty field) and can be shown with a toggle. Known data limit: OpenStreetMap building coverage is patchy and building heights are mostly untagged (drawn at a default height), so the surroundings can look flatter and emptier than reality in places.

**Scope:** one orange-zone (medium-to-high-density residential) area of Bangkok, under the 2013 Comprehensive Plan. The plot is assumed to be an empty field.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev      # local dev server
npm test         # geometry tests (Vitest)
npm run build    # type check + production build into dist/
npm run preview  # serve the production build
```

## If the live map is down (fallback)

The basemap and buildings are loaded live from OpenFreeMap. A baked copy of the OSM building footprints within 2 km of the example plot is shipped as `public/data/buildings.geojson` (source, licence and extraction date: `public/data/README.md`; regenerate with `node scripts/bake-buildings.mjs`).
It is used only when the live service fails:
- the live style file cannot be downloaded (error, or no answer within 12 s; slow tiles alone do not count): the map is rebuilt on a plain background with the baked buildings (no street map, no edge numbers);
- the style loads but its tiles keep failing: the baked buildings are added on top of the base map.

The panel then says it is showing a saved copy. To try it: open the app with `?basemap=local` (force the fallback) or `?basemap=broken` (simulate a failing live style).

## Deploy (Cloudflare Pages, static)

```bash
npm ci
npm run build        # type check + production build into dist/
```

**Deployment is manual.** Pushing to GitHub does not update the live site: after a push, build and upload `dist/` yourself. The live site may therefore be behind `main`.

Upload the **contents of `dist/`** with Cloudflare Pages "Direct Upload" (or connect the repo with build command `npm run build` and output folder `dist`). A zip of the same folder works too.

The build includes:

- `dist/assets/maplibre-gl-worker.mjs`: MapLibre's worker. It must be in the upload, otherwise the map never loads ("Worker failed to load" in the browser console).
- `dist/_headers`: Cloudflare Pages cache and security headers (fingerprinted assets cached for a year, the entry page always revalidated). Cloudflare consumes this file; it is not a page.
- `dist/data/buildings.geojson`: the baked OSM fallback (2 MB, ODbL; source and date in `dist/data/README.md`).

There is no backend, no environment variable, no build secret and no server-side routing to configure. The live basemap comes from OpenFreeMap at run time; if that service is down the baked fallback keeps the demo usable (`?basemap=local` forces it).

### Deployment checklist

After deploying, open the live URL and check:

1. The panel says "Loading the map…" and then "Click “Draw plot”…" (not the saved-copy warning).
2. Press **Example plot**: the plot appears at Sukhumvit Road / Soi 95, with 2,000 m², FAR 5 and three concept designs.
3. Switch **Building type** to Hotel and Shophouse rows; the numbers and checklist change.
4. The browser console shows no errors and no failed requests.
5. The map shows "© OpenStreetMap contributors" with a working link, plus OpenFreeMap / OpenMapTiles.
6. Open `?basemap=local`: the saved buildings still load, to prove the 2 MB fallback file was uploaded.

The production build can be checked locally with `npm run preview` (serves `dist/` on port 4173).

## Stack

All open source, built as a static site (no backend), to be hosted on Cloudflare Pages.

| Need | Tool |
|---|---|
| App | Vite, TypeScript, React, Zustand |
| Map and real site | MapLibre GL JS |
| 3D envelope and designs | MapLibre fill-extrusion layers (thin 0.8 m slices, so the height limit reads as a smooth slope). |
| Drawing the plot | Terra Draw |
| Geometry | clipper-lib (Clipper 6: boolean ops and rounded insets), own helpers in `src/geo/` |
| Tests | Vitest |

## Layout

```
src/App.tsx             map, drawing and side panel
src/store.ts            app state
src/mapData.ts          turns results into map layers
src/geo/                local metre frame, polygon helpers (clip, shrink, area)
src/rules/              zone limits and setback rules (rule IDs match docs/zoning-rules.md)
src/engine/index.ts     envelope, height plane, floor stacking, three designs, checklist
src/existingBuildings.ts  hides OSM buildings that stand on the plot
src/EdgeUses.tsx        what each plot edge borders (neighbour, road, canal)
src/Credits.tsx         data and credits panel
src/engine/worker.ts      runs the engine off the main thread
src/useCompute.ts       hook that talks to the worker (one request at a time, latest wins)
src/engine/engine.test.ts
docs/zoning-rules.md    rules, sources, assumptions
```

## Data and credits

- **Map data:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
- **Basemap tiles and style:** [OpenFreeMap](https://openfreemap.org), built on OpenStreetMap data and [OpenMapTiles](https://openmaptiles.org).
- **Geometry library:** [clipper-lib](https://github.com/junmer/clipper-lib) (JavaScript port of Angus Johnson's Clipper 6), Boost Software Licence.
- The attribution is shown on the map at all times. Do not hide it.
- Any data files baked into this repo are derived from OpenStreetMap, are under the ODbL, and must be listed with their source and extraction date in `data/README.md`.
- Zoning rules come from Bangkok's Comprehensive Plan and the Building Control Act regulations. Each rule used in the tool must cite its source document.

## Future scope (known limits, not built)

These are things the prototype does not do, or does only partly. They are listed so nobody mistakes them for finished work.

- **Check the example plot on the official parcel tool.** The zone sub-area (Y.7-21, read by eye from the 2013 map), the road widths and the station distance of the Example plot are estimates. The BMA parcel tool or the "Check ผังเมือง กทม." app should confirm them.
- **One zone family.** Only the orange zone types in the zone list are supported, and you pick the zone yourself. The tool does not look the zone up from the official map, and other Bangkok zones are not covered.
- **Open rule questions.** Some readings are assumptions (A-xx), for example the fire lane and the road-width tests. They are listed in `docs/zoning-rules.md`. FAR bonuses are not modelled, and parking is information only.
- **Neighbour realism.** OpenStreetMap heights are mostly missing, so many neighbours are drawn at a default height, and building coverage is patchy. Better height data would make the surroundings more convincing.
- **Camera.** The 3D view is MapLibre's camera, tilting up to 80° (MapLibre calls angles above 60° experimental). A free-orbit viewer built on Three.js was considered and left out: it would need its own copy of the surroundings and a second renderer.
- **Redevelopment.** The plot is treated as an empty field. Existing buildings on it are hidden and count for nothing. Demolition rules, existing-structure rights and heritage limits are out of scope.
- **Plot size.** Plots under 100 m² are refused with a message. A very large plot (about 15,000 m² and up) can take around 0.8 s to compute; this runs in a Web Worker, so the page stays responsive.
- **Test coverage.** 154 automated tests pass, including a seeded fuzz of 200 random plots. But 37 of the 52 rule and assumption IDs are not named in any test (`docs/test-coverage.md`). Some are probably exercised without being named. The list is a pointer, not proof.
- **Map service.** The live basemap comes from OpenFreeMap. If it is down, a saved copy of the buildings around the Example plot (about 2 km) is shown, and other places show no buildings.
- **Devices.** Checked in headless Chrome at desktop and phone width, but not on a real phone and not reviewed by a second person.
- **Not offered.** No export (for example GLB or PDF), no saving or sharing of a plot, no comparison of plots.
- **CI.** A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the tests and the production build on every push and pull request. It does not deploy: deployment is manual.

## Licence

The code is under the [MIT licence](LICENSE), © 2026 Mrugesh Thesiya.

This covers the source code and the documentation. It does **not** cover data derived from OpenStreetMap: `docs/area-stats.csv` and any other baked data file are derived from OpenStreetMap, are under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/), and need the credit "© OpenStreetMap contributors". Third-party libraries keep their own licences (MapLibre GL JS BSD-3-Clause, clipper-lib Boost, React, Terra Draw and Zustand MIT).
