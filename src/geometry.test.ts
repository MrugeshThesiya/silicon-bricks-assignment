import { describe, expect, it } from 'vitest'
import type { Polygon } from 'geojson'
import { insetPlot, plotArea, subtract } from './geometry'

// ~100 m x 100 m square near Bangkok
const sq = (x: number, y: number, s: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
})
const plot = sq(100.5, 13.75, 0.0009)

describe('geometry', () => {
  it('computes a plausible area', () => {
    const a = plotArea(plot)
    expect(a).toBeGreaterThan(9000)
    expect(a).toBeLessThan(11000)
  })
  it('inset shrinks the plot', () => {
    const inner = insetPlot(plot, 5)!
    expect(plotArea(inner)).toBeLessThan(plotArea(plot))
  })
  it('subtract removes area', () => {
    const [res] = subtract(plot, sq(100.5, 13.75, 0.0003))
    expect(plotArea(res)).toBeLessThan(plotArea(plot))
  })
})
