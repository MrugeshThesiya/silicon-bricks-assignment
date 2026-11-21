import type { XY } from '../geo/frame'
import { areaMP, intersection, polyOf, type MP } from '../geo/poly'
import { ROWS } from '../rules/uses'

/** The part of a plot edge that rows are laid out against: its end points and inward normal (see Edge in ./index). */
type EdgeLike = { a: XY; b: XY; length: number; n: XY }

export type RowLayout = {
  /** One rectangle per row of units. */
  footprint: MP
  /** Each row: number of units and its length (first column to last). */
  rows: { units: number; length: number }[]
  units: number
  unitWidth: number
  depth: number
  /** Ground floor area of one unit. */
  unitArea: number
  /** Every row has at least 3 m of plot behind it (R-55c). */
  rearOk: boolean
}

/**
 * One band of shophouse units along the road edge (R-55, A-21): 5 m wide and 16 m deep, at most 8 units (40 m) to a row,
 * one unit-width gap (5 m, at least 4 m) between rows, inside the under-23 m envelope. Returns null if not even one unit fits.
 */
export function layoutRows(env: MP, plot: MP, edge: EdgeLike): RowLayout | null {
  const W = ROWS.unitWidth, D = ROWS.depth
  const t: XY = [(edge.b[0] - edge.a[0]) / edge.length, (edge.b[1] - edge.a[1]) / edge.length]
  const n = edge.n
  const toWorld = (u: number, v: number): XY => [edge.a[0] + t[0] * u + n[0] * v, edge.a[1] + t[1] * u + n[1] * v]
  const rect = (u0: number, u1: number, v0: number, v1: number): MP => polyOf([toWorld(u0, v0), toWorld(u1, v0), toWorld(u1, v1), toWorld(u0, v1)])
  const inside = (r: MP, region: MP) => areaMP(intersection(r, region)) >= 0.995 * areaMP(r)

  let uMin = Infinity, uMax = -Infinity, vMin = Infinity
  for (const p of env) for (const q of p[0]) {
    const u = (q[0] - edge.a[0]) * t[0] + (q[1] - edge.a[1]) * t[1]
    const v = (q[0] - edge.a[0]) * n[0] + (q[1] - edge.a[1]) * n[1]
    uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); vMin = Math.min(vMin, v)
  }
  if (!Number.isFinite(uMin)) return null
  const v0 = vMin, v1 = vMin + D
  const maxPerRow = Math.min(ROWS.maxUnitsPerRow, Math.floor(ROWS.maxRowLength / W)) // columns W apart: 8 units span 40 m

  // Try shifting the grid along the edge in 1 m steps and keep the layout that fits the most units.
  let best: { rows: { start: number; n: number }[]; units: number } | null = null
  for (let off = 0; off < W; off++) {
    const start = uMin + off
    const cells = Math.floor((uMax - start) / W)
    const ok: boolean[] = []
    for (let k = 0; k < cells; k++) ok.push(inside(rect(start + k * W, start + (k + 1) * W, v0, v1), env))
    const rows: { start: number; n: number }[] = []
    let units = 0
    for (let k = 0; k < cells; ) {
      if (!ok[k]) { k++; continue }
      let m = 0
      while (k + m < cells && ok[k + m]) m++
      for (let i = 0; i < m; ) {
        const take = Math.min(maxPerRow, m - i)
        rows.push({ start: start + (k + i) * W, n: take })
        units += take
        i += take + 1 // the next unit-width is left empty as the gap between rows
      }
      k += m
    }
    if (units > (best?.units ?? 0)) best = { rows, units }
  }
  if (!best) return null

  const footprint: MP = best.rows.flatMap((r) => rect(r.start, r.start + r.n * W, v0, v1))
  const rearOk = best.rows.every((r) => inside(rect(r.start, r.start + r.n * W, v1, v1 + ROWS.rear), plot))
  return {
    footprint,
    rows: best.rows.map((r) => ({ units: r.n, length: r.n * W })),
    units: best.units,
    unitWidth: W,
    depth: D,
    unitArea: W * D,
    rearOk,
  }
}
