# Bangkok Plot Planner

A browser tool for a developer who owns a plot in Bangkok and wants to know what they can build on it before paying an architect. The user draws a plot on a map, and the tool shows the zoning rules that apply, the 3D space the building may fill, and concept designs that fit, each with a pass/fail checklist.

**Status:** working prototype. Press **Example plot** for a ready-made corner plot on Sukhumvit Road and Soi 95 (its zone, road widths and station distance are estimates), or draw a plot (any shape), pick the zone type, the road edge and its width, and say what the other sides border (neighbour, another road, or a canal). The tool shows the rules that apply, the space allowed under 23 m and for a high-rise (with the road height limit as a stepped slope), and three concept designs (low-rise block, tower, podium plus tower), each with a pass/fail checklist that cites rule IDs. Existing OSM buildings on the plot are hidden by default (the plot is treated as an empty field) and can be shown with a toggle. Known data limit: OpenStreetMap building coverage is patchy and building heights are mostly untagged (drawn at a default height), so the surroundings can look flatter and emptier than reality in places.

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

Upload the **contents of `dist/`** with Cloudflare Pages "Direct Upload" (or connect the repo with build command `npm run build` and output folder `dist`).
`dist/assets/maplibre-gl-worker.mjs` must be in the upload: without it the map never loads ("Worker failed to load" in the browser console).
After deploying, open the live URL, wait for "Click “Draw plot”…" to appear in the panel, press **Example plot**, and check that the browser console shows no errors.
There is no backend, no environment variable and no server-side routing to configure.

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

## Licence

The code is under the [MIT licence](LICENSE), © 2026 Mrugesh Thesiya.

This covers the source code and the documentation. It does **not** cover data derived from OpenStreetMap: `docs/area-stats.csv` and any other baked data file are derived from OpenStreetMap, are under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/), and need the credit "© OpenStreetMap contributors". Third-party libraries keep their own licences (MapLibre GL JS BSD-3-Clause, clipper-lib Boost, React, Terra Draw and Zustand MIT).
