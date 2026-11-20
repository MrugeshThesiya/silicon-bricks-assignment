import { area, buffer, polygon } from '@turf/turf'
import type { Polygon } from 'geojson'
import * as polyclip from 'polyclip-ts'

/** Plot area in square metres. */
export function plotArea(plot: Polygon): number {
  return area(polygon(plot.coordinates))
}

/** Uniform inward offset in metres (placeholder for per-edge setbacks). */
export function insetPlot(plot: Polygon, metres: number): Polygon | null {
  const out = buffer(polygon(plot.coordinates), -metres, { units: 'meters' })
  return out && out.geometry.type === 'Polygon' ? out.geometry : null
}

/** Subtract polygon `b` from `a` using polygon clipping (used later for per-edge setback strips). */
export function subtract(a: Polygon, b: Polygon): Polygon[] {
  const res = polyclip.difference(a.coordinates as polyclip.Geom, b.coordinates as polyclip.Geom)
  return res.map((coordinates) => ({ type: 'Polygon', coordinates: coordinates as Polygon['coordinates'] }))
}
