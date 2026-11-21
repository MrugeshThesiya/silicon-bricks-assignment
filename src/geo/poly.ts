import ClipperLib, { type PolyNode, type PolyTree } from 'clipper-lib'
import type { XY } from './frame'

export type Ring = XY[]
export type Poly = Ring[]
export type MP = Poly[]

// Clipper works on integers, so metres are scaled to 0.1 mm. Areas are measured on the rounded result, so they stay consistent.
const SCALE = 1e4
type CPath = { X: number; Y: number }[]
const toPath = (r: Ring): CPath => openRing(r).map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }))
const fromPath = (p: CPath): Ring => closeRing(p.map((q) => [q.X / SCALE, q.Y / SCALE] as XY))

function fromTree(tree: PolyTree): MP {
  const out: MP = []
  const visit = (nodes: PolyNode[]) => {
    for (const n of nodes) {
      if (n.IsHole()) continue
      const poly: Poly = [fromPath(n.Contour())]
      for (const h of n.Childs()) {
        poly.push(fromPath(h.Contour()))
        visit(h.Childs()) // islands inside holes
      }
      out.push(poly)
    }
  }
  visit(tree.Childs())
  return out
}

const rings = (mp: MP): CPath[] => mp.flatMap((poly) => poly.map(toPath))

function boolean(type: number, subject: CPath[], clip: CPath[], subjectFill: number, clipFill: number): MP {
  const c = new ClipperLib.Clipper()
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true)
  c.AddPaths(clip, ClipperLib.PolyType.ptClip, true)
  const tree = new ClipperLib.PolyTree()
  c.Execute(type, tree, subjectFill, clipFill)
  return fromTree(tree)
}

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
const toCW = (r: Ring): Ring => (ringArea(r) > 0 ? [...r].reverse() : r)

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

/**
 * Drop corners that sit within `eps` metres of the line between their neighbours (this also removes repeated points).
 * Keeps vertex counts from growing as insets are stacked, and removes near-coincident points that can upset the clipper.
 */
export function simplifyRing(ring: Ring, eps = 0.01): Ring {
  let r = openRing(ring)
  let changed = true
  while (changed && r.length > 3) {
    changed = false
    const next: Ring = []
    for (let i = 0; i < r.length; i++) {
      const p = r[i], a = next.length ? next[next.length - 1] : r[(i + r.length - 1) % r.length], b = r[(i + 1) % r.length]
      const abx = b[0] - a[0], aby = b[1] - a[1]
      const len = Math.hypot(abx, aby)
      const dist = len < 1e-12 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs((p[0] - a[0]) * aby - (p[1] - a[1]) * abx) / len
      if (dist < eps && r.length - (i - next.length + 1) > 3) changed = true
      else next.push(p)
    }
    r = next
  }
  return closeRing(r)
}

const cleaned = (mp: MP, minArea = 0.25): MP =>
  mp
    .filter((p) => Math.abs(ringArea(p[0])) >= minArea)
    .map((p) => p.map((r) => simplifyRing(r)))

export function polyOf(ring: Ring): MP {
  return [[closeRing(ring)]]
}

export function difference(subject: MP, clips: Ring[]): MP {
  if (clips.length === 0) return subject
  const F = ClipperLib.PolyFillType
  // Subject: even-odd, so holes work whatever their winding. Clips overlap each other, so they use non-zero (a union).
  return cleaned(boolean(ClipperLib.ClipType.ctDifference, rings(subject), clips.map(toPath), F.pftEvenOdd, F.pftNonZero))
}

export function intersection(a: MP, b: MP): MP {
  if (a.length === 0 || b.length === 0) return []
  const F = ClipperLib.PolyFillType
  return cleaned(boolean(ClipperLib.ClipType.ctIntersection, rings(a), rings(b), F.pftEvenOdd, F.pftEvenOdd))
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

/** Remove everything within `t` metres of any edge: a rounded inward offset. */
export function shrink(mp: MP, t: number): MP {
  if (t <= 0) return mp
  const co = new ClipperLib.ClipperOffset(2, 0.02 * SCALE) // arcs within 2 cm of a true circle
  for (const poly of mp) {
    // Clipper wants outer rings counter-clockwise and holes clockwise.
    const paths = poly.map((r, i) => toPath(i === 0 ? toCCW(r) : toCW(r)))
    co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  }
  const tree = new ClipperLib.PolyTree()
  co.Execute(tree, -t * SCALE)
  return cleaned(fromTree(tree))
}

/**
 * Shrink evenly until the area equals `target` (to 2 cm², far below any rule's precision).
 * Area falls smoothly as the inset grows, so a bracketed secant search (Illinois) needs a handful of
 * evaluations where plain bisection needs about 30.
 */
export function shrinkToArea(mp: MP, target: number): MP {
  const a0 = areaMP(mp)
  if (a0 <= target) return mp
  let lo = 0, flo = a0 - target // area above target
  let hi = Math.sqrt(a0), fhi = -target // inset of sqrt(area) removes everything
  let best: MP = mp, bestErr = flo
  let side = 0
  for (let i = 0; i < 40; i++) {
    let t = (lo * fhi - hi * flo) / (fhi - flo)
    if (!(t > lo && t < hi)) t = (lo + hi) / 2
    const m = shrink(mp, t)
    const f = areaMP(m) - target
    if (Math.abs(f) < bestErr) { best = m; bestErr = Math.abs(f) }
    if (bestErr < 2e-3) break
    if (f > 0) {
      lo = t; flo = f
      if (side === 1) fhi /= 2
      side = 1
    } else {
      hi = t; fhi = f
      if (side === -1) flo /= 2
      side = -1
    }
  }
  return best
}

/** True when the ring has no repeated points and no edges that cross each other. */
export function isSimple(ring: Ring): boolean {
  const r = openRing(ring)
  const n = r.length
  if (n < 3) return false
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n]
    if (a[0] === b[0] && a[1] === b[1]) return false
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue // neighbours share a corner
      const c = r[j], d = r[(j + 1) % n]
      const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b)
      if (d1 * d2 < 0 && d3 * d4 < 0) return false
    }
  }
  return true
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
