import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Geometry, Polygon } from 'geojson'
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

type Feat = { id?: string | number; geometry: Geometry; properties?: Record<string, unknown> | null }

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

/** One building part: a single polygon, with the id of the tile feature it came from. */
type Part = { id?: string | number; poly: number[][][]; h: number; b: number; hit: boolean }

function* partsOf(f: Feat): Generator<Part> {
  const g = f.geometry
  const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : []
  const p = f.properties ?? {}
  const h = Number(p.render_height ?? p.h ?? 5), b = Number(p.render_min_height ?? p.b ?? 0)
  for (const poly of polys) yield { id: f.id, poly, h: Number.isFinite(h) ? h : 5, b: Number.isFinite(b) ? b : 0, hit: false }
}

const boundsOf = (poly: number[][][]): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const c of poly[0]) { b[0] = Math.min(b[0], c[0]); b[1] = Math.max(b[1], c[0]); b[2] = Math.min(b[2], c[1]); b[3] = Math.max(b[3], c[1]) }
  return b
}

export type HidingPlan = {
  /** Ids to hide from the style's building layers. */
  ids: (string | number)[]
  /** The parts of those ids that do NOT stand on the plot, to be drawn again (see below). */
  residual: Feature<Polygon, { h: number; b: number }>[]
}

/**
 * Which buildings stand on the plot, and what has to be drawn instead.
 *
 * The tiles merge every building of the same height into one feature (thousands of parts), so a feature id names a height bucket,
 * not a building. Hiding "the building" by id would hide every building in the bucket. So the buckets that touch the plot are hidden
 * by id, and all their other parts are returned as `residual` to be drawn again. Pure, so it is easy to test.
 */
export function planHiding(features: Feat[], plot: [number, number][]): HidingPlan {
  if (plot.length < 4) return { ids: [], residual: [] }
  const lons = plot.map((p) => p[0]), lats = plot.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const frame = new Frame((x0 + x1) / 2, (y0 + y1) / 2)
  const plotMP = polyOf(toCCW(plot.slice(0, -1).map((p) => frame.toXY(p))))
  const ring = (r: number[][]): Ring => r.map((c) => frame.toXY([c[0], c[1]]))

  const parts: Part[] = []
  const ids = new Set<string | number>()
  for (const f of features) {
    for (const part of partsOf(f)) {
      parts.push(part)
      if (part.id === undefined) continue
      // Cheap bounding-box test first; most parts are nowhere near the plot.
      const [bx0, bx1, by0, by1] = boundsOf(part.poly)
      if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue
      if (areaMP(intersection([part.poly.map(ring)], plotMP)) > MIN_OVERLAP) {
        part.hit = true
        ids.add(part.id)
      }
    }
  }
  const residual = parts
    .filter((p) => p.id !== undefined && ids.has(p.id) && !p.hit)
    .map((p): Feature<Polygon, { h: number; b: number }> => ({ type: 'Feature', properties: { h: p.h, b: p.b }, geometry: { type: 'Polygon', coordinates: p.poly } }))
  return { ids: [...ids], residual }
}

/** Ids of the building features whose footprint overlaps the plot. */
export function buildingIdsOnPlot(features: Feat[], plot: [number, number][]): (string | number)[] {
  return planHiding(features, plot).ids
}

const RESIDUAL_SOURCE = 'residual-buildings'
const RESIDUAL_LAYER = 'residual-buildings-3d'

/** Draw the parts that stay when their height bucket is hidden. Pass an empty list to clear. */
export function setResidualBuildings(map: MapLibreMap, features: HidingPlan['residual']) {
  const data = { type: 'FeatureCollection' as const, features }
  const src = map.getSource(RESIDUAL_SOURCE) as GeoJSONSource | undefined
  if (src) return void src.setData(data)
  if (!features.length) return
  map.addSource(RESIDUAL_SOURCE, { type: 'geojson', data })
  // Look like the style's own buildings, so the parts that are drawn again are not noticeable.
  const live = map.getLayer('building-3d')
  const color = (live && map.getPaintProperty('building-3d', 'fill-extrusion-color')) || '#d6d3d1'
  const opacity = (live && map.getPaintProperty('building-3d', 'fill-extrusion-opacity')) || 0.92
  map.addLayer(
    {
      id: RESIDUAL_LAYER, source: RESIDUAL_SOURCE, type: 'fill-extrusion',
      paint: {
        'fill-extrusion-color': color as string,
        'fill-extrusion-opacity': opacity as number,
        'fill-extrusion-height': ['coalesce', ['get', 'h'], 5],
        'fill-extrusion-base': ['coalesce', ['get', 'b'], 0],
      },
    },
    map.getLayer('env-low') ? 'env-low' : undefined,
  )
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
