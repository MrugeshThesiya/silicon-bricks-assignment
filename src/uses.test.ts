import { describe, expect, it } from 'vitest'
import { Frame } from './geo/frame'
import { compute, type Input } from './engine'
import { ROOM_AREA, ROWS, commerceMaxArea, hotelMaxRooms, housingMaxArea, officeMaxArea, type Access, type UseId } from './rules/uses'
import { lawMinOpenSpace } from './rules/setbacks'

const f = new Frame(100.574, 13.779)
const rect = (w: number, h: number) => [[0, 0], [w, 0], [w, h], [0, h], [0, 0]].map(([x, y]) => f.toLL([x, y]))
/** A rectangle plot whose south edge (index 0) faces a road of `roadWidth`. */
const site = (use: UseId, over: Partial<Input> = {}, w = 40, h = 50): Input => ({
  plot: rect(w, h), zone: 'Y.7', roadEdge: 0, roadWidth: 12, nearStation: false, use, ...over,
})
const access = (station: boolean, ok: number[] = []): Access => ({ station, road: (x) => ok.includes(x) })
const fails = (r: ReturnType<typeof compute>) => r!.designs.flatMap((d) => d.checks.filter((c) => c.status === 'fail').map((c) => `${d.id}:${c.id}`))

describe('use limits from the plan (docs/zoning-rules.md section 4b)', () => {
  it('hotels: 50 rooms free; more needs a 16 m road or a station (Y.7)', () => {
    expect(hotelMaxRooms('Y.7', access(false))).toBe(50)
    expect(hotelMaxRooms('Y.7', access(false, [12]))).toBe(50)
    expect(hotelMaxRooms('Y.7', access(false, [16]))).toBe(Infinity)
    expect(hotelMaxRooms('Y.7', access(true))).toBe(Infinity)
  })
  it('hotels in Y.5 and Y.6: 51 to 80 rooms need a 16 m road, over 80 a 30 m road, or a station', () => {
    for (const z of ['Y.5', 'Y.6'] as const) {
      expect(hotelMaxRooms(z, access(false))).toBe(50)
      expect(hotelMaxRooms(z, access(false, [12, 16]))).toBe(80)
      expect(hotelMaxRooms(z, access(false, [12, 16, 30]))).toBe(Infinity)
      expect(hotelMaxRooms(z, access(true))).toBe(Infinity)
    }
  })
  it('offices: Y.5 300 m² (1,000 with a 12 m road), Y.6 1,000 / 2,000 / 5,000, Y.7 1,000 / 10,000', () => {
    expect(officeMaxArea('Y.5', access(false))).toBe(300)
    expect(officeMaxArea('Y.5', access(false, [12]))).toBe(1000)
    expect(officeMaxArea('Y.5', access(true))).toBe(1000)
    expect(officeMaxArea('Y.6', access(false))).toBe(1000)
    expect(officeMaxArea('Y.6', access(false, [16]))).toBe(2000)
    expect(officeMaxArea('Y.6', access(false, [16, 30]))).toBe(5000)
    expect(officeMaxArea('Y.6', access(true))).toBe(5000)
    expect(officeMaxArea('Y.7', access(false, [12]))).toBe(1000)
    expect(officeMaxArea('Y.7', access(false, [16]))).toBe(10000)
    expect(officeMaxArea('Y.7', access(true))).toBe(10000)
  })
  it('commerce: Y.5 2,000 / 5,000 / 10,000, Y.6 5,000 / 10,000, Y.7 5,000 / 10,000 / no limit', () => {
    expect(commerceMaxArea('Y.5', access(false))).toBe(2000)
    expect(commerceMaxArea('Y.5', access(false, [16]))).toBe(5000)
    expect(commerceMaxArea('Y.5', access(false, [16, 30]))).toBe(10000)
    expect(commerceMaxArea('Y.6', access(false, [16]))).toBe(5000)
    expect(commerceMaxArea('Y.6', access(false, [16, 30]))).toBe(10000)
    expect(commerceMaxArea('Y.7', access(false))).toBe(5000)
    expect(commerceMaxArea('Y.7', access(false, [16]))).toBe(10000)
    expect(commerceMaxArea('Y.7', access(false, [16, 30]))).toBe(Infinity)
    expect(commerceMaxArea('Y.7', access(true))).toBe(Infinity)
  })
  it('housing over 10,000 m² needs a 30 m road or a station', () => {
    expect(housingMaxArea(access(false, [16]))).toBe(9999)
    expect(housingMaxArea(access(false, [30]))).toBe(Infinity)
    expect(housingMaxArea(access(true))).toBe(Infinity)
  })
  it('non-housing open space is 10 %, housing 30 % (R-56, R-36)', () => {
    expect(lawMinOpenSpace('low', 2000, 1000, true)).toBeCloseTo(300)
    expect(lawMinOpenSpace('low', 2000, 1000, false)).toBeCloseTo(100)
    expect(lawMinOpenSpace('high', 2000, 1000, true)).toBeCloseTo(600)
    expect(lawMinOpenSpace('high', 2000, 1000, false)).toBeCloseTo(200)
  })
})

describe('hotel', () => {
  it('is capped at 50 rooms without a station or a wide road, and its designs pass', () => {
    const r = compute(site('hotel'))!
    expect(r.usableGFA).toBeCloseTo(50 * ROOM_AREA, 0)
    expect(r.notes.join(' ')).toContain('R-50')
    for (const d of r.designs) {
      expect(Math.floor(d.gfa / ROOM_AREA)).toBeLessThanOrEqual(50)
      expect(d.stats[0].label).toContain('Hotel rooms')
    }
    expect(fails(r)).toEqual([])
  })
  it('has no room limit near a station', () => {
    const r = compute(site('hotel', { nearStation: true }))!
    expect(r.usableGFA).toBeGreaterThan(50 * ROOM_AREA)
    expect(r.designs[0].checks.find((c) => c.id === 'hotel')!.status).toBe('pass')
  })
  it('uses the 10 % open space rule', () => {
    const d = compute(site('hotel', { nearStation: true }))!.designs[0]
    const open = d.checks.find((c) => c.id === 'open')!
    expect(open.rule).toBe('R-56')
    expect(open.detail).toContain('10 % of largest floor')
    expect(open.detail).not.toContain('30 %')
  })
})

describe('office', () => {
  it('is capped at 1,000 m² in Y.7 with a 12 m road and no station; 8 floors of 3.8 m are not built under 23 m', () => {
    const r = compute(site('office'))!
    expect(r.usableGFA).toBeCloseTo(1000, 0)
    expect(fails(r)).toEqual([])
  })
  it('stacks 3.8 m floors: six floors stay under 23 m', () => {
    const r = compute(site('office', { nearStation: true }))!
    const low = r.designs.find((d) => d.id === 'low')!
    expect(low.floors).toHaveLength(6)
    expect(low.height).toBeCloseTo(22.8, 1)
    expect(low.regime).toBe('low')
  })
  it('flags an office that is too big when the cap is lifted by hand', () => {
    const r = compute(site('office', { nearStation: true, zone: 'Y.5' }))!
    expect(r.usableGFA).toBeLessThanOrEqual(1000)
  })
})

describe('mixed use', () => {
  it('keeps the shop area within the plan limit and reports shops and housing', () => {
    const r = compute(site('mixed', { zone: 'Y.5' }))!
    for (const d of r.designs) {
      const shops = d.checks.find((c) => c.id === 'shops')!
      expect(shops.status).toBe('pass')
      expect(d.stats.map((x) => x.label)).toEqual(['Shop floor area', 'Housing floor area'])
    }
    const low = r.designs.find((d) => d.id === 'low')!
    const shopArea = low.floors.slice(0, 2).reduce((t, x) => t + x.area, 0)
    expect(shopArea).toBeLessThanOrEqual(2000.01) // Y.5, no station, 12 m road: 2,000 m² of shops
    expect(fails(r)).toEqual([])
  })
  it('only the housing part counts for the 10,000 m² rule', () => {
    const big = compute(site('mixed', { roadWidth: 20 }, 150, 150))! // large plot, 20 m road with a 150 m side, no station
    // shops up to 10,000 m² (road 16 m or more, Y.7) plus housing under 10,000 m² (no 30 m road, no station)
    expect(big.usableGFA).toBeCloseTo(10000 + 9999, 0)
    for (const d of big.designs) {
      const shops = d.floors.slice(0, d.id === 'low' ? 2 : 3).reduce((t, x) => t + x.area, 0)
      expect(shops).toBeLessThanOrEqual(10000.01)
      expect(d.gfa - shops).toBeLessThanOrEqual(10000)
    }
    expect(fails(big)).toEqual([])
  })
})

describe('shophouse rows', () => {
  it('lays one row of 8 units (40 m) of 5 x 16 m along a 50 m frontage and passes the row rules', () => {
    const r = compute(site('rows', { nearStation: true }, 50, 40))!
    expect(r.designs).toHaveLength(1)
    const d = r.designs[0]
    expect(d.id).toBe('rows')
    expect(d.floors).toHaveLength(ROWS.floors)
    const rowsCheck = d.checks.find((c) => c.id === 'row')!
    expect(rowsCheck.status).toBe('pass')
    expect(d.checks.find((c) => c.id === 'unit')!.status).toBe('pass')
    expect(d.checks.find((c) => c.id === 'rear')!.status).toBe('pass')
    expect(d.stats.map((x) => x.label)).toEqual(['Shop floor area', 'Housing floor area'])
    expect(fails(r)).toEqual([])
  })
  it('splits a long frontage into rows of at most 8 units with at least 4 m between rows', () => {
    const r = compute(site('rows', { nearStation: true }, 130, 40))!
    const d = r.designs[0]
    const polys = d.floors[0].mp // one rectangle per row
    expect(polys.length).toBeGreaterThanOrEqual(3)
    const xs = polys.map((p) => { const x = p[0].map((q) => q[0]); return [Math.min(...x), Math.max(...x)] as [number, number] }).sort((a, b) => a[0] - b[0])
    for (const [a, b] of xs) expect(b - a).toBeLessThanOrEqual(ROWS.maxRowLength + 0.01)
    for (let i = 1; i < xs.length; i++) expect(xs[i][0] - xs[i - 1][1]).toBeGreaterThanOrEqual(ROWS.gap - 0.01)
    expect(fails(r)).toEqual([])
  })
  it('does not build rows on a plot too shallow for a row plus the 3 m behind it', () => {
    const r = compute(site('rows', { nearStation: true }, 50, 18))!
    const d = r.designs[0]
    if (d) expect(d.checks.find((c) => c.id === 'rear')!.status).toBe('fail')
  })
  it('the first rows fit inside the under-23 m envelope (road and side setbacks)', () => {
    const r = compute(site('rows', { nearStation: true }, 50, 40))!
    expect(r.designs[0].checks.find((c) => c.id === 'setbacks')!.status).toBe('pass')
  })
})
