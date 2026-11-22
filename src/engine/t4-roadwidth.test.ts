import { describe, expect, it } from 'vitest'
import { Frame } from '../geo/frame'
import { roadSetbackLow } from '../rules/setbacks'
import { compute, type Input } from './index'

describe('R-11..R-14 road-width boundaries', () => {
  it.each([[2,5],[6,3],[9.99,1.005],[10,1],[11.99,1.199],[12,1.2],[19.99,1.999],[20,2],[29.99,2],[30,2],[36,2],[80,2]])('R-11..R-14 width %s gives setback %s', (width, setback) => {
    expect(roadSetbackLow(width)).toBeCloseTo(setback, 6)
  })
})

// 40 m x 50 m plot, south edge on the road, Y.7 (FAR 5): big enough for a tower on any road that allows one.
const f = new Frame(100.574, 13.779)
const rect = [[0, 0], [40, 0], [40, 50], [0, 50], [0, 0]].map(([x, y]) => f.toLL([x, y]))
const at = (roadWidth: number) => compute({ plot: rect, zone: 'Y.7', roadEdge: 0, roadWidth, nearStation: false } as Input)!

describe('road width: height rule and the 23 m line', () => {
  const widths = [6, 9.99, 10, 11.99, 12, 19.99, 20, 29.99, 30, 36, 80]

  it.each(widths)('R-20 width %s: no floor is higher than 2 x the distance to the far side of the road', (w) => {
    const r = at(w)
    const { a, n } = r.plane // a point on the road edge and its normal, which points into the plot
    for (const d of r.designs) {
      for (const fl of d.floors) {
        for (const poly of fl.mp) for (const ring of poly) for (const [x, y] of ring) {
          const inside = (x - a[0]) * n[0] + (y - a[1]) * n[1] // metres from the plot boundary on the road side
          expect(fl.top, `${d.id} level ${fl.level} at ${inside.toFixed(1)} m`).toBeLessThanOrEqual(2 * (w + inside) + 0.05)
        }
      }
    }
  })

  it.each(widths)('R-30 width %s: a building of 23 m or more only on a road of at least 10 m', (w) => {
    const r = at(w)
    const tall = r.designs.filter((d) => d.height >= 23)
    if (w < 10) {
      expect(tall).toHaveLength(0)
      expect(r.designs.every((d) => d.id === 'low')).toBe(true)
    } else {
      expect(tall.length).toBeGreaterThan(0)
    }
  })

  it.each(widths)('R-20 width %s: the height plane comes from the road that was entered, and low-rise stays under 23 m', (w) => {
    const r = at(w)
    expect(r.plane.width).toBeCloseTo(w, 6)
    for (const d of r.designs.filter((x) => x.id === 'low')) expect(d.height).toBeLessThan(23)
  })
})
