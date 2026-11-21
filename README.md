# Bangkok Plot Planner

A browser tool for a developer who owns a plot in Bangkok and wants to know what they can build on it before paying an architect. The user draws a plot on a map, and the tool shows the zoning rules that apply, the 3D space the building may fill, and concept designs that fit, each with a pass/fail checklist.

**Status:** working prototype. Draw a plot (any shape), pick the zone type, the road edge and its width, and say what the other sides border (neighbour, another road, or a canal). The tool shows the rules that apply, the space allowed under 23 m and for a high-rise (with the road height limit as a stepped slope), and three concept designs (low-rise block, tower, podium plus tower), each with a pass/fail checklist that cites rule IDs. Existing OSM buildings on the plot are hidden by default (the plot is treated as an empty field) and can be shown with a toggle. Not yet built: deployment, checks against the official zoning map, a smooth sloped envelope, basements and parking layout, other zones and building types.

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

## Stack

All open source, built as a static site (no backend), to be hosted on Cloudflare Pages.

| Need | Tool |
|---|---|
| App | Vite, TypeScript, React, Zustand |
| Map and real site | MapLibre GL JS |
| 3D envelope and designs | MapLibre fill-extrusion layers (stepped slices). Three.js is installed for a smooth sloped surface later. |
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

To be decided.
