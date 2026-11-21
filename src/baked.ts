import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

/**
 * Fallback for when the live OpenFreeMap service cannot be reached.
 * `public/data/buildings.geojson` is a baked copy of the OSM building footprints around the example plot
 * (see public/data/README.md; regenerate with `node scripts/bake-buildings.mjs`). It is shown only when the live map fails.
 */
export const BAKED_URL = `${import.meta.env.BASE_URL}data/buildings.geojson`
export const BAKED_SOURCE = 'baked-buildings'
export const BAKED_LAYER = 'baked-buildings-3d'

/** A plain style used when the live style cannot be loaded at all: just a background, no network needed. */
export const LOCAL_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ece9e1' } }],
}

/** Add the baked buildings as 3D blocks under `before` (the design layer, so buildings are drawn first). Resolves false if the file is missing or not valid GeoJSON. */
export async function addBakedBuildings(map: MapLibreMap, before?: string): Promise<boolean> {
  try {
    if (map.getSource(BAKED_SOURCE)) return true
    const r = await fetch(BAKED_URL)
    if (!r.ok) return false
    const data = (await r.json()) as FeatureCollection
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) return false
    if (map.getSource(BAKED_SOURCE)) return true // another call finished first
    map.addSource(BAKED_SOURCE, {
      type: 'geojson',
      data,
      attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> (saved copy, via OpenFreeMap)',
    })
    map.addLayer(
      {
        id: BAKED_LAYER, source: BAKED_SOURCE, type: 'fill-extrusion',
        paint: {
          'fill-extrusion-color': '#d6d3d1',
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-height': ['coalesce', ['get', 'h'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'b'], 0],
        },
      },
      before && map.getLayer(before) ? before : undefined,
    )
    return true
  } catch {
    return false // map removed meanwhile, offline, or invalid JSON (a missing file can come back as the app's HTML page)
  }
}
