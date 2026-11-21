import { describe, expect, it } from 'vitest'
import { featureFilter } from '@maplibre/maplibre-gl-style-spec'
import { Frame } from './geo/frame'
import { buildingIdsOnPlot } from './existingBuildings'

const f = new Frame(100.574, 13.779)
const ll = (pts: number[][]) => pts.map(([x, y]) => f.toLL([x, y]))
const box = (x: number, y: number, w: number, h: number) => ll([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]])
const feat = (id: number, ring: [number, number][]) => ({ id, geometry: { type: 'Polygon' as const, coordinates: [ring] } })

// 40 m x 50 m plot with its corner at the origin.
const plot = box(0, 0, 40, 50)

describe('buildings on the plot', () => {
  const found = buildingIdsOnPlot(
    [
      feat(1, box(10, 10, 10, 10)), // fully inside
      feat(2, box(35, 20, 15, 10)), // straddles the east edge
      feat(3, box(60, 10, 10, 10)), // a neighbour
      feat(4, box(40, 10, 8, 8)), // only shares the plot edge
      feat(2, box(35, 20, 15, 10)), // the same building cut by a tile edge: listed once
      feat(5, box(-3, 52, 10, 10)), // just across the north edge, no overlap
    ],
    plot,
  )
  it('hides buildings that stand on the plot, including ones that only partly overlap', () => {
    expect(found.sort()).toEqual([1, 2])
  })
  it('keeps neighbours, including ones that touch the boundary', () => {
    expect(found).not.toContain(3)
    expect(found).not.toContain(4)
    expect(found).not.toContain(5)
  })
  it('does nothing without a plot', () => {
    expect(buildingIdsOnPlot([feat(1, box(0, 0, 5, 5))], [])).toEqual([])
  })
})

describe('layer filter', () => {
  // Same shape as setHiddenBuildings(): the style's own filter AND NOT in the hidden ids.
  const filter = featureFilter(['all', ['!', ['has', 'hide_3d']], ['!', ['in', ['id'], ['literal', [1569621090, 7977815782]]]]], 'layers[0].filter')
  const test = (id: number, props: Record<string, unknown> = {}) =>
    filter.filter({ zoom: 16 }, { id, properties: props, type: 3, geometry: [] } as never)
  it('drops the listed ids, even large ones, and keeps the rest', () => {
    expect(test(7977815782)).toBe(false)
    expect(test(1569621090)).toBe(false)
    expect(test(42)).toBe(true)
  })
  it('still applies the style\'s own condition', () => {
    expect(test(42, { hide_3d: true })).toBe(false)
  })
})
