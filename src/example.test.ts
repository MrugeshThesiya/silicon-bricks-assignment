import { describe, expect, it } from 'vitest'
import { Frame } from './geo/frame'
import { areaMP, ringArea } from './geo/poly'
import { compute } from './engine'
import { EXAMPLE, STATION } from './example'

const input = { plot: EXAMPLE.plot, zone: EXAMPLE.zone, roadEdge: EXAMPLE.roadEdge, roadWidth: EXAMPLE.roadWidth, nearStation: EXAMPLE.nearStation, extra: EXAMPLE.extra }

describe('example plot (Sukhumvit Road x Soi 95)', () => {
  const r = compute(input)!
  const f = new Frame(STATION[0], STATION[1])
  it('is a 50 m x 40 m plot of 2,000 m²', () => {
    expect(r.plotArea).toBeCloseTo(2000, 0)
    expect(Math.abs(ringArea(EXAMPLE.plot.slice(0, -1).map((p) => f.toXY(p))))).toBeGreaterThan(1900)
  })
  it('is within 500 m of the BTS station from every corner (A-10)', () => {
    for (const p of EXAMPLE.plot) {
      const [x, y] = f.toXY(p)
      expect(Math.hypot(x, y)).toBeLessThan(250)
    }
  })
  it('faces Soi 95 (12 m) on edge 2 and Sukhumvit Road (36 m) on edge 3, and the road sets the height plane', () => {
    expect(r.edges[2].length).toBeCloseTo(50, 0)
    expect(r.edges[3].length).toBeCloseTo(40, 0)
    expect(r.uses[2]).toEqual({ kind: 'road', width: 12 })
    expect(r.uses[3]).toEqual({ kind: 'road', width: 36 })
    expect(r.plane.width).toBe(36)
    expect(r.plane.n[0]).toBeGreaterThan(0.5) // the plane rises from the Sukhumvit side (west edge) towards the east
  })
  it('allows 10,000 m² at FAR 5 and gives three designs that pass every check', () => {
    expect(Math.abs(r.maxGFA - 10000)).toBeLessThan(15) // coordinates are rounded to 1 cm
    expect(r.designs.map((d) => d.id)).toEqual(['low', 'tower', 'podium'])
    for (const d of r.designs) expect(d.checks.filter((c) => c.status === 'fail')).toEqual([])
    expect(areaMP(r.envLow)).toBeGreaterThan(900)
  })
  it('includes the corner-plot length check (R-22)', () => {
    expect(r.designs[0].checks.some((c) => c.id === 'corner')).toBe(true)
  })
})
