# Bangkok Plot Planner

A browser tool for a developer who owns a plot in Bangkok and wants to know what they can build on it before paying an architect. The user draws a plot on a map, and the tool shows the zoning rules that apply, the 3D space the building may fill, and concept designs that fit, each with a pass/fail checklist.

**Status:** working prototype. Draw a plot, pick the zone type, the road edge and its width, and the tool shows the rules, the space allowed under 23 m and for a high-rise (with the road height limit as a stepped slope), and two concept designs with a pass/fail checklist. Not yet built: hiding existing OSM buildings on the plot, per-edge setbacks for several roads or canals, deployment, and checks against the official zoning map.

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
| Geometry | polyclip-ts, own helpers in `src/geo/` |
| Tests | Vitest |

## Layout

```
src/App.tsx             map, drawing and side panel
src/store.ts            app state
src/mapData.ts          turns results into map layers
src/geo/                local metre frame, polygon helpers (clip, shrink, area)
src/rules/              zone limits and setback rules (rule IDs match docs/zoning-rules.md)
src/engine/index.ts     envelope, height plane, floor stacking, designs, checklist
src/engine/engine.test.ts
docs/zoning-rules.md    rules, sources, assumptions
```

## Data and credits

- **Map data:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
- **Basemap tiles and style:** [OpenFreeMap](https://openfreemap.org), built on OpenStreetMap data and [OpenMapTiles](https://openmaptiles.org).
- The attribution is shown on the map at all times. Do not hide it.
- Any data files baked into this repo are derived from OpenStreetMap, are under the ODbL, and must be listed with their source and extraction date in `data/README.md`.
- Zoning rules come from Bangkok's Comprehensive Plan and the Building Control Act regulations. Each rule used in the tool must cite its source document.

## Licence

To be decided.
