import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Frame } from './geo/frame'
import type { MP } from './geo/poly'
import type { Floor, Result, Slice } from './engine'

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

function geometry(mp: MP, frame: Frame): Geometry {
  return {
    type: 'MultiPolygon',
    coordinates: mp.map((poly) => poly.map((ring) => ring.map((p) => frame.toLL(p)))),
  }
}

const extrusion = (mp: MP, frame: Frame, base: number, top: number): Feature => ({
  type: 'Feature',
  properties: { b: base, h: top },
  geometry: geometry(mp, frame),
})

export const slicesToFC = (slices: Slice[], frame: Frame): FeatureCollection => ({
  type: 'FeatureCollection',
  features: slices.map((s) => extrusion(s.mp, frame, s.base, s.top)),
})

export const floorsToFC = (floors: Floor[], frame: Frame): FeatureCollection => {
  // Merge consecutive floors that share a footprint into one block.
  const feats: Feature[] = []
  let run: Floor[] = []
  const flush = () => {
    if (run.length) feats.push(extrusion(run[0].mp, frame, run[0].base, run[run.length - 1].top))
    run = []
  }
  for (const f of floors) {
    if (run.length && Math.abs(run[0].area - f.area) > 0.05) flush()
    run.push(f)
  }
  flush()
  return { type: 'FeatureCollection', features: feats }
}

/** Every plot edge as a line with its number; roads and canals are coloured, neighbours are invisible (only the label shows). */
export const edgesToFC = (r: Result | null): FeatureCollection => {
  if (!r) return empty
  return {
    type: 'FeatureCollection',
    features: r.edges.map((e, i): Feature => ({
      type: 'Feature',
      properties: { label: `${i + 1}`, kind: r.uses[i]?.kind ?? 'plot', main: i === r.roadEdge },
      geometry: { type: 'LineString', coordinates: [r.frame.toLL(e.a), r.frame.toLL(e.b)] },
    })),
  }
}

export { empty }
