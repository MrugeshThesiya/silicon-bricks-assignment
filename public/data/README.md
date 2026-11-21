# Baked building footprints (`buildings.geojson`)

A small, offline copy of the OpenStreetMap building footprints around the app's example plot. It is a **fallback only**: the map normally draws buildings from the live OpenFreeMap vector tiles, and this file is what the app can show if that service is unreachable.

## Licence and credit (required)

- The data is derived from **OpenStreetMap** and is licensed under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- Required credit: **© OpenStreetMap contributors**, linked to <https://www.openstreetmap.org/copyright>.
- The tiles were produced by [OpenFreeMap](https://openfreemap.org) with the [OpenMapTiles](https://www.openmaptiles.org/) schema. Credit both alongside the OpenStreetMap credit.
- This file is a Derived Database under the ODbL. If you redistribute it, keep this notice and the same licence.

## Extraction

| | |
| --- | --- |
| Extraction date | 2026-11-21T17:42:27Z |
| Tile source | `https://tiles.openfreemap.org/planet/20261115_080022_pt/{z}/{x}/{y}.pbf` |
| Tile version | `20261115_080022_pt` |
| Zoom | 14 (the highest zoom OpenFreeMap publishes; z15+ tiles come back empty) |
| Tiles used | 9, all HTTP 200 |
| Centre | 13.6986001 N, 100.6048848 E (`EXAMPLE.center` in `src/example.ts`) |
| Radius | 2,000 m |
| Coordinate precision | 6 decimals (about 0.11 m) |
| Features | 8,835 (one single `Polygon` per building part) |
| Total footprint area inside the circle | 1.79 km² |
| File size | 1,995 KiB raw, 206 KiB gzip |

## Regenerating

```sh
node scripts/bake-buildings.mjs
```

Needs Node with `fetch` (Node 18 or newer) and the already installed `@mapbox/vector-tile` and `pbf` packages. Nothing is installed and no other file is touched. The script:

1. reads the current tile URL template from <https://tiles.openfreemap.org/planet> (the version is not hard-coded),
2. fetches the z14 tiles covering the 2 km circle, three at a time with a 250 ms pause and the generic `User-Agent` `bangkok-plot-planner-bake/1.0`,
3. decodes the `building` layer and keeps the parts that intersect the circle,
4. writes `public/data/buildings.geojson`.

Size budget: the file must stay under 3 MB. If it ever grows past that, the script first drops to 5 coordinate decimals, then shrinks the radius to 1.5 km; the values actually used are recorded in `metadata`. The current run used 6 decimals and 2 km.

## Structure

A GeoJSON `FeatureCollection` with a top-level `bbox` and a `metadata` object that repeats the values above (`source`, `license`, `attribution`, `extractionDate`, `tileVersion`, `tileUrlTemplate`, `zoom`, `centre`, `radiusMetres`, `coordinateDecimals`, `featureCount`).

Each feature is one closed `Polygon` (one building part) in WGS84 lon/lat, with properties:

- `h` — height in metres, from OpenMapTiles `render_height`. It is mostly the 5 m default because OSM `height` tags are sparse: 8,589 of the 8,835 footprints carry the 5 m default, the rest range from 3 m to 173 m.
- `b` — base height in metres, from OpenMapTiles `render_min_height` (0 for nearly everything).

The feature `id` is the numeric id of the *tile feature* the part came from (see below): only 68 distinct ids occur, and one id is shared by 5,675 parts.

### Things to know before using it

- **An id is many buildings.** The source z14 tiles merge every building with the same `render_height` in a tile into a single `MultiPolygon` feature (a few features per tile, thousands of parts). So an `id` names a height bucket, not a building, and is not a stable key for one building. Hiding "by id" hides every part that shares it; the app therefore redraws the parts that should stay (see `src/existingBuildings.ts`). Two ids (`3187458310`, `7126504712`) appear on two features each, because adjacent tiles merged the same building into two buckets.
- **The circle test is per part.** The source features were split into their individual polygons first, and each part is kept whole: 0.84 % of the vertices are up to 218 m outside the 2 km radius (the outward edge of buildings that straddle the boundary).
- **Tile-edge duplicates are kept.** Buildings cut by a tile edge appear as separate parts in more than one place; only byte-identical duplicates were dropped. Do not assume one footprint appears once.
- **Heights are coarse.** OSM height tags are sparse in Bangkok, so the fallback is a flat 5 m wall of low buildings plus the taller ones that are tagged.

## Other baked data

`src/example.ts` also holds the example plot and station coordinates, but that is app code, not baked data.
