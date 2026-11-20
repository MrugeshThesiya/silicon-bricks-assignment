# Bangkok Plot Planner

A browser tool for a developer who owns a plot in Bangkok and wants to know what they can build on it before paying an architect. The user draws a plot on a map, and the tool shows the zoning rules that apply, the 3D space the building may fill, and concept designs that fit, each with a pass/fail checklist.

**Status:** early scaffold. Today it shows a 3D map of Bangkok, lets you draw and edit a plot of any shape, and reports its area. Zoning rules, the allowed envelope, concept designs and the checklist are not built yet.

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
| 3D envelope and designs | Three.js |
| Drawing the plot | Terra Draw |
| Geometry | Turf.js, polyclip-ts |
| Tests | Vitest |

## Layout

```
src/App.tsx            map, drawing and side panel
src/store.ts           plot state
src/geometry.ts        area, inset and polygon subtraction
src/geometry.test.ts   geometry tests
```

## Data and credits

- **Map data:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
- **Basemap tiles and style:** [OpenFreeMap](https://openfreemap.org), built on OpenStreetMap data and [OpenMapTiles](https://openmaptiles.org).
- The attribution is shown on the map at all times. Do not hide it.
- Any data files baked into this repo are derived from OpenStreetMap, are under the ODbL, and must be listed with their source and extraction date in `data/README.md`.
- Zoning rules come from Bangkok's Comprehensive Plan and the Building Control Act regulations. Each rule used in the tool must cite its source document.

## Licence

To be decided.
