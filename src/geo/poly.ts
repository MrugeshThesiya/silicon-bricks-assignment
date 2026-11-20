import * as pc from 'polyclip-ts'
import type { XY } from './frame'

export type Ring = XY[]
export type Poly = Ring[]
export type MP = Poly[]

/** Signed area. Positive for counter-clockwise rings. Works with or without a repeated closing point. */
export function ringArea(r: Ring): number {
  let s = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i]
    const [x2, y2] = r[(i + 1) % r.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

export function areaMP(mp: MP): number {
  let total = 0
  for (const poly of mp) {
    poly.forEach((ring, i) => {
      const a = Math.abs(ringArea(ring))
      total += i === 0 ? a : -a
    })
  }
  return total
}

export const closeRing = (r: Ring): Ring => {
  const f = r[0], l = r[r.length - 1]
  return f[0] === l[0] && f[1] === l[1] ? r : [...r, f]
}
export const openRing = (r: Ring): Ring => {
  const f = r[0], l = r[r.length - 1]
  return r.length > 1 && f[0] === l[0] && f[1] === l[1] ? r.slice(0, -1) : r
}
export const toCCW = (r: Ring): Ring => (ringArea(r) < 0 ? [...r].reverse() : r)

/** Polygon covering every point within `rad` metres of segment a-b (rounded ends). */
export function capsule(a: XY, b: XY, rad: number, steps = 8): Ring {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0])
  const pts: Ring = []
  for (let i = 0; i <= steps; i++) {
    const t = th - Math.PI / 2 + (Math.PI * i) / steps
    pts.push([b[0] + rad * Math.cos(t), b[1] + rad * Math.sin(t)])
  }
  for (let i = 0; i <= steps; i++) {
    const t = th + Math.PI / 2 + (Math.PI * i) / steps
    pts.push([a[0] + rad * Math.cos(t), a[1] + rad * Math.sin(t)])
  }
  return closeRing(pts)
}

const cleaned = (mp: MP, minArea = 0.25): MP =>
  mp.filter((p) => Math.abs(ringArea(p[0])) >= minArea)

export function polyOf(ring: Ring): MP {
  return [[closeRing(ring)]]
}

export function difference(subject: MP, clips: Ring[]): MP {
  if (clips.length === 0) return subject
  return cleaned(pc.difference(subject as pc.Geom, ...clips.map((c) => [c] as pc.Geom)) as MP)
}

export function intersection(a: MP, b: MP): MP {
  if (a.length === 0 || b.length === 0) return []
  return cleaned(pc.intersection(a as pc.Geom, b as pc.Geom) as MP)
}

export function edgesOf(mp: MP): [XY, XY][] {
  const out: [XY, XY][] = []
  for (const poly of mp)
    for (const ring of poly) {
      const r = openRing(ring)
      for (let i = 0; i < r.length; i++) out.push([r[i], r[(i + 1) % r.length]])
    }
  return out
}

/** Remove everything within `t` metres of any edge. */
export function shrink(mp: MP, t: number): MP {
  if (t <= 0) return mp
  return difference(mp, edgesOf(mp).map(([a, b]) => capsule(a, b, t)))
}

/** Shrink evenly until the area is at most `target`. */
export function shrinkToArea(mp: MP, target: number): MP {
  if (areaMP(mp) <= target) return mp
  let lo = 0
  let hi = Math.sqrt(areaMP(mp)) // larger than any possible inset, so the search brackets the answer
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    areaMP(shrink(mp, mid)) > target ? (lo = mid) : (hi = mid)
  }
  return shrink(mp, hi)
}

/** Keep the part of `mp` with dot(p - a, n) >= offset. `n` must be a unit vector. */
export function clipHalfPlane(mp: MP, a: XY, n: XY, offset: number, extent = 5000): MP {
  const t: XY = [-n[1], n[0]]
  const q: XY = [a[0] + n[0] * offset, a[1] + n[1] * offset]
  const rect: Ring = closeRing([
    [q[0] - t[0] * extent, q[1] - t[1] * extent],
    [q[0] + t[0] * extent, q[1] + t[1] * extent],
    [q[0] + t[0] * extent + n[0] * extent, q[1] + t[1] * extent + n[1] * extent],
    [q[0] - t[0] * extent + n[0] * extent, q[1] - t[1] * extent + n[1] * extent],
  ])
  return intersection(mp, [[rect]])
}
