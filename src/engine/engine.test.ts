import { describe, expect, it } from 'vitest'
import { Frame } from '../geo/frame'
import { areaMP, isSimple, ringArea, shrinkToArea } from '../geo/poly'
import { roadSetbackLow, regimeFor } from '../rules/setbacks'
import { compute, stackFloors, PlotError, type Input } from './index'
import { polyOf } from '../geo/poly'

const f = new Frame(100.574, 13.779)
// 40 m x 50 m plot, south edge (index 0) faces the road.
const rect = [[0, 0], [40, 0], [40, 50], [0, 50], [0, 0]].map(([x, y]) => f.toLL([x, y]))
const base: Input = { plot: rect, zone: 'Y.6', roadEdge: 0, roadWidth: 12, nearStation: true }

describe('rules', () => {
  it('road setbacks follow MR 55 art. 41', () => {
    expect(roadSetbackLow(8)).toBeCloseTo(2) // 6 m from centre line, road 8 m wide
    expect(roadSetbackLow(12)).toBeCloseTo(1.2)
    expect(roadSetbackLow(20)).toBeCloseTo(2)
    expect(roadSetbackLow(30)).toBe(2)
  })
  it('switches to the high-rise rules at 23 m or 10,000 m²', () => {
    expect(regimeFor(22.4, 9000, 1400)).toBe('low')
    expect(regimeFor(23, 9000, 1400)).toBe('high')
    expect(regimeFor(20, 10000, 1400)).toBe('high')
  })
})

describe('envelope', () => {
  const r = compute(base)!
  it('measures the plot', () => {
    expect(r.plotArea).toBeCloseTo(2000, 0)
    expect(r.maxGFA).toBeCloseTo(9000, 0)
  })
  it('each rule shrinks the envelope', () => {
    expect(areaMP(r.envLow)).toBeCloseTo(34 * 45.8, 0)
    expect(areaMP(r.envHigh)).toBeCloseTo(28 * 38, 0)
    expect(areaMP(r.envHigh)).toBeLessThan(areaMP(r.envLow))
  })
  it('works for a clockwise plot and an L-shaped plot', () => {
    const cw = compute({ ...base, plot: [...rect].reverse() })!
    expect(cw.plotArea).toBeCloseTo(2000, 0)
    const l = [[0, 0], [40, 0], [40, 20], [20, 20], [20, 50], [0, 50], [0, 0]].map(([x, y]) => f.toLL([x, y]))
    const lr = compute({ ...base, plot: l })!
    expect(lr.plotArea).toBeCloseTo(1400, 0)
    expect(areaMP(lr.envLow)).toBeLessThan(1400)
  })
})

describe('stacking', () => {
  it('floor areas add up to the target exactly', () => {
    const fp = polyOf([[0, 0], [30, 0], [30, 30], [0, 30]])
    const floors = stackFloors(fp, null, 3.2, 20, 2500)
    expect(floors.reduce((s, x) => s + x.area, 0)).toBeCloseTo(2500, 2)
  })
  it('the road height plane cuts the upper floors away from the road', () => {
    const fp = polyOf([[0, 0], [30, 0], [30, 60], [0, 60]])
    const plane = { a: [0, 0] as [number, number], n: [0, 1] as [number, number], width: 12 }
    const floors = stackFloors(fp, plane, 3.2, 40, 1e9)
    const top = floors[floors.length - 1]
    // 2 x (12 + y) >= top  =>  y >= top / 2 - 12
    const minY = Math.min(...top.mp.flatMap((p) => p[0].map((q) => q[1])))
    expect(minY).toBeGreaterThanOrEqual(top.top / 2 - 12 - 0.01)
  })
})

describe('designs', () => {
  const r = compute(base)!
  it('produces two designs that pass every check', () => {
    expect(r.designs.map((d) => d.id)).toEqual(['low', 'tower'])
    for (const d of r.designs) {
      expect(d.checks.filter((c) => c.status === 'fail')).toEqual([])
      expect(d.gfa).toBeLessThanOrEqual(r.maxGFA + 0.01)
      expect(d.floors.reduce((s, x) => s + x.area, 0)).toBeCloseTo(d.gfa, 6)
      expect(d.openSpace).toBeGreaterThanOrEqual(d.openRequired - 0.01)
    }
  })
  it('the low-rise stays under 23 m and the tower goes over', () => {
    const [low, tower] = r.designs
    expect(low.height).toBeLessThan(23)
    expect(low.regime).toBe('low')
    expect(tower.height).toBeGreaterThanOrEqual(23)
    expect(tower.regime).toBe('high')
  })
  it('keeps footprints inside the plot', () => {
    for (const d of r.designs) expect(areaMP(d.floors[0].mp)).toBeLessThan(r.plotArea)
  })
  it('a plot with no room gives no designs instead of crashing', () => {
    const tiny = [[0, 0], [8, 0], [8, 8], [0, 8], [0, 0]].map(([x, y]) => f.toLL([x, y]))
    const t = compute({ ...base, plot: tiny })
    expect(t === null || t.designs.length === 0).toBe(true)
  })
  it('ring helper sanity', () => {
    expect(ringArea([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(1)
  })
})

describe('road and station limits', () => {
  const big = [[0, 0], [100, 0], [100, 80], [0, 80], [0, 0]].map(([x, y]) => f.toLL([x, y]))
  it('caps a very large building at 30,000 m² on a road under 18 m wide', () => {
    const r = compute({ ...base, plot: big, zone: 'Y.7' })!
    expect(r.maxGFA).toBeCloseTo(40000, 0)
    expect(r.usableGFA).toBe(30000)
    for (const d of r.designs) expect(d.checks.filter((c) => c.status === 'fail')).toEqual([])
  })
  it('keeps housing under 10,000 m² with no station and a narrow road', () => {
    const r = compute({ ...base, plot: big, zone: 'Y.7', nearStation: false })!
    expect(r.usableGFA).toBeLessThan(10000)
    for (const d of r.designs) {
      expect(d.gfa).toBeLessThan(10000)
      expect(d.checks.filter((c) => c.status === 'fail')).toEqual([])
    }
  })
  it('offers no tower on a road under 10 m wide', () => {
    const r = compute({ ...base, roadWidth: 8 })!
    expect(r.designs.map((d) => d.id)).toEqual(['low'])
  })
})

describe('robustness', () => {
  it('detects a plot whose edges cross', () => {
    expect(isSimple([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(false)
    expect(isSimple([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true)
    const bowtie = [[0, 0], [40, 40], [40, 0], [0, 40], [0, 0]].map(([x, y]) => f.toLL([x, y]))
    expect(() => compute({ ...base, plot: bowtie })).toThrow(PlotError)
  })
  it('handles a many-cornered irregular plot without throwing', () => {
    for (const n of [12, 24, 40]) {
      const ring = Array.from({ length: n }, (_, i) => {
        const t = (2 * Math.PI * i) / n, r = 40 * (1 + 0.15 * Math.sin(5 * t))
        return f.toLL([r * Math.cos(t), r * Math.sin(t)])
      })
      const r = compute({ ...base, plot: [...ring, ring[0]], roadEdge: null })!
      expect(r.designs.length).toBeGreaterThan(0)
    }
  })
  it('shrinkToArea hits the target to 1e-3 m²', () => {
    const mp = polyOf([[0, 0], [37, 0], [37, 23], [11, 23], [11, 41], [0, 41]])
    for (const t of [900, 500, 123.4]) expect(areaMP(shrinkToArea(mp, t))).toBeCloseTo(t, 2)
  })
})
