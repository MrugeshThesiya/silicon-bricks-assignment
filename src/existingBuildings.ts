import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { Geometry } from 'geojson'
import { Frame } from './geo/frame'
import { BAKED_LAYER, BAKED_SOURCE } from './baked'
import { areaMP, intersection, polyOf, toCCW, type MP, type Ring } from './geo/poly'

/**
 * The basemap draws OSM buildings in two layers. The plot is treated as an empty field (A-01), so buildings that
 * stand on it are hidden by default: they would clash with the envelopes and designs, and they count for nothing
 * in the floor area or open space. Neighbouring buildings are never touched.
 */
const LAYERS = ['building', 'building-3d', BAKED_LAYER]
const SOURCE = 'openmaptiles'
const MIN_OVERLAP = 0.2 // m²; ignores a neighbour that only touches the plot edge

type Feat = { id?: string | number; geometry: Geometry }

function toMP(g: Geometry, frame: Frame): MP {
  const ring = (r: number[][]): Ring => r.map((c) => frame.toXY([c[0], c[1]]))
  if (g.type === 'Polygon') return [g.coordinates.map(ring)]
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.map(ring))
  return []
}

function lonLatBounds(g: Geometry): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity]
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      b[0] = Math.min(b[0], c[0]); b[1] = Math.max(b[1], c[0]); b[2] = Math.min(b[2], c[1] as number); b[3] = Math.max(b[3], c[1] as number)
    } else if (Array.isArray(c)) c.forEach(walk)
  }
  if ('coordinates' in g) walk(g.coordinates)
  return b
}

/** Ids of the building features whose footprint overlaps the plot. Pure, so it is easy to test. */
export function buildingIdsOnPlot(features: Feat[], plot: [number, number][]): (string | number)[] {
  if (plot.length < 4) return []
  const lons = plot.map((p) => p[0]), lats = plot.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const frame = new Frame((x0 + x1) / 2, (y0 + y1) / 2)
  const plotMP = polyOf(toCCW(plot.slice(0, -1).map((p) => frame.toXY(p))))
  const ids = new Set<string | number>()
  for (const f of features) {
    if (f.id === undefined || ids.has(f.id)) continue
    // Cheap bounding-box test first; most buildings in a loaded tile are nowhere near the plot.
    const [bx0, bx1, by0, by1] = lonLatBounds(f.geometry)
    if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue
    const mp = toMP(f.geometry, frame)
    if (mp.length && areaMP(intersection(mp, plotMP)) > MIN_OVERLAP) ids.add(f.id)
  }
  return [...ids]
}

const original = new Map<string, FilterSpecification | undefined>()

/** Hide the given building ids in both building layers, or restore the style's own filters when `ids` is empty. */
export function setHiddenBuildings(map: MapLibreMap, ids: (string | number)[]) {
  for (const layer of LAYERS) {
    if (!map.getLayer(layer)) continue
    if (!original.has(layer)) original.set(layer, map.getFilter(layer) as FilterSpecification | undefined)
    const base = original.get(layer)
    const hide: FilterSpecification = ['!', ['in', ['id'], ['literal', ids]]]
    map.setFilter(layer, ids.length ? ((base ? ['all', base, hide] : hide) as FilterSpecification) : (base ?? null))
  }
}

/** Building features that are loaded right now: the live tiles, and the baked fallback copy when it is on the map. */
export function loadedBuildings(map: MapLibreMap): Feat[] {
  const out: Feat[] = []
  if (map.getSource(SOURCE)) out.push(...(map.querySourceFeatures(SOURCE, { sourceLayer: 'building' }) as unknown as Feat[]))
  if (map.getSource(BAKED_SOURCE)) out.push(...(map.querySourceFeatures(BAKED_SOURCE) as unknown as Feat[]))
  return out
}
