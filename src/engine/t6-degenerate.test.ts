import { describe, expect, it } from 'vitest'
import { compute, PlotError, type Input } from './index'
import { Frame } from '../geo/frame'

const f = new Frame(100.574, 13.779)
const pts = (xy: number[][]) => xy.map(([x, y]) => f.toLL([x, y]))
const base: Input = { plot: [], zone: 'Y.7', roadEdge: 0, roadWidth: 12, nearStation: false }
const run = (xy: number[][]) => compute({ ...base, plot: pts(xy) })
const clean = [[0, 0], [40, 0], [40, 50], [0, 50]]

describe('degenerate plots give a clear, fast and finite outcome', () => {
  it('fewer than 3 points: nothing to compute', () => {
    expect(run([[0, 0], [1, 0]])).toBeNull()
    expect(run([])).toBeNull()
  })
  it('collinear points (zero area): nothing to compute', () => {
    expect(run([[0, 0], [10, 0], [20, 0]])).toBeNull()
  })
  it('a corner clicked twice gives the same result as the clean plot (regression: it used to say the outline crosses itself)', () => {
    const ok = run(clean)!
    for (const dup of [
      [[0, 0], [40, 0], [40, 0], [40, 50], [0, 50]],
      [[0, 0], [40, 0], [40, 50], [0, 50], [0, 50]],
      [[0, 0], [0, 0], [40, 0], [40, 50], [0, 50]],
      [[0, 0], [40, 0], [40, 50], [0, 50], [0, 0], [0, 0]],
    ]) {
      const r = run(dup)!
      expect(r.plotArea).toBeCloseTo(ok.plotArea, 6)
      expect(r.edges).toHaveLength(ok.edges.length)
      expect(r.designs.length).toBe(ok.designs.length)
    }
  })
  it('a bow-tie (edges cross) is rejected with a PlotError that tells the user what to do', () => {
    expect(() => run([[0, 0], [10, 10], [10, 0], [0, 10]])).toThrow(PlotError)
    expect(() => run([[0, 0], [10, 10], [10, 0], [0, 10]])).toThrow(/crosses itself/)
  })
  it('longitude and latitude swapped still gives a finite answer or a clear error, never NaN', () => {
    const r = compute({ ...base, plot: [[13, 100], [13.001, 100], [13.001, 100.001], [13, 100.001], [13, 100]] })
    expect(r === null || (Number.isFinite(r.plotArea) && r.plotArea > 0)).toBe(true)
  })
  it('a 200,000 m² plot finishes in under 2 s with only finite numbers', () => {
    const t0 = performance.now()
    const r = run([[0, 0], [500, 0], [500, 400], [0, 400]])!
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(r.plotArea).toBeCloseTo(200000, -2)
    const bad = (v: unknown): boolean => (typeof v === 'number' ? !Number.isFinite(v) : Array.isArray(v) ? v.some(bad) : v && typeof v === 'object' ? Object.values(v).some(bad) : false)
    expect(bad({ ...r, frame: undefined })).toBe(false)
  })
})
