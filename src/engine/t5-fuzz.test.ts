// Seeded invariant fuzz (audit task T5). Deterministic: the same 200 plots every run. A failure prints the seed index and the plot.
import { describe, expect, it } from 'vitest'
import { Frame } from '../geo/frame'
import { areaMP, difference, type Ring } from '../geo/poly'
import { compute, PlotError, type Input } from './index'
import { USES, type UseId } from '../rules/uses'

const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const shoelace = (p: [number, number][]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1] }, 0)) / 2

/** A random simple polygon in metres, scaled to a random area from 300 to 20,000 m². */
function shape(rnd: () => number): { kind: string; pts: [number, number][] } {
  const kind = ['triangle', 'convex', 'L', 'U', 'jagged'][Math.floor(rnd() * 5)]
  let pts: [number, number][]
  if (kind === 'triangle') {
    pts = [[0, 0], [10 + rnd() * 30, 0], [rnd() * 40, 8 + rnd() * 30]]
  } else if (kind === 'convex') {
    const n = 5 + Math.floor(rnd() * 4), rx = 15 + rnd() * 20, ry = 10 + rnd() * 25
    pts = Array.from({ length: n }, (_, i) => [rx * Math.cos((i / n) * 2 * Math.PI), ry * Math.sin((i / n) * 2 * Math.PI)])
  } else if (kind === 'L') {
    const w = 30 + rnd() * 30, h = 30 + rnd() * 30, a = 10 + rnd() * 12, b = 10 + rnd() * 12
    pts = [[0, 0], [w, 0], [w, b], [a, b], [a, h], [0, h]]
  } else if (kind === 'U') {
    const w = 40 + rnd() * 30, h = 30 + rnd() * 25, a = 10 + rnd() * 8, d = 12 + rnd() * 12
    pts = [[0, 0], [w, 0], [w, h], [w - a, h], [w - a, d], [a, d], [a, h], [0, h]]
  } else {
    // star-shaped, so it never crosses itself, with strongly varying radius
    const n = 8 + Math.floor(rnd() * 8)
    pts = Array.from({ length: n }, (_, i) => {
      const r = 8 + rnd() * 30, t = ((i + rnd() * 0.5) / n) * 2 * Math.PI
      return [r * Math.cos(t), r * Math.sin(t)]
    })
  }
  const target = 300 + rnd() * 19700
  const k = Math.sqrt(target / shoelace(pts)), rot = rnd() * 2 * Math.PI
  pts = pts.map(([x, y]) => [(x * Math.cos(rot) - y * Math.sin(rot)) * k, (x * Math.sin(rot) + y * Math.cos(rot)) * k])
  return { kind, pts }
}

const finite = (v: unknown, path = 'result'): string | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? null : `${path} = ${v}`
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const e = finite(v[i], `${path}[${i}]`); if (e) return e } return null }
  if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { const e = finite(x, `${path}.${k}`); if (e) return e } }
  return null
}

describe('seeded invariant fuzz: 200 random plots', () => {
  const uses = Object.keys(USES) as UseId[]
  const frame = new Frame(100.6063, 13.6982)
  const problems: string[] = []
  let designsSeen = 0, nullResults = 0, errors = 0, slowest = 0, slowestTag = ''

  it('keeps its invariants on every plot', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = mulberry32(seed)
      const { kind, pts } = shape(rnd)
      const ring = [...pts, pts[0]].map((p) => frame.toLL(p))
      const use = uses[seed % uses.length]
      const input: Input = {
        plot: ring, zone: 'Y.7', use,
        roadEdge: Math.floor(rnd() * pts.length), roadWidth: 6 + rnd() * 30, nearStation: rnd() < 0.5,
      }
      const tag = `seed ${seed} (${kind}, ${use}, ${shoelace(pts).toFixed(0)} m², road ${input.roadWidth.toFixed(1)} m)`
      const t0 = performance.now()
      let r: ReturnType<typeof compute>
      try {
        r = compute(input)
      } catch (e) {
        if (e instanceof PlotError) { errors++; continue }
        problems.push(`${tag}: unexpected exception ${(e as Error).message}`)
        continue
      }
      const ms = performance.now() - t0
      if (ms > slowest) { slowest = ms; slowestTag = tag }
      if (ms > 1000) problems.push(`${tag}: took ${ms.toFixed(0)} ms`)
      if (!r) { nullResults++; continue }
      const nan = finite({ ...r, frame: undefined })
      if (nan) { problems.push(`${tag}: non-finite number at ${nan}`); continue }
      const plotRing: Ring = r.edges.map((e) => e.a)
      for (const d of r.designs) {
        designsSeen++
        const at = `${tag}, design ${d.id}`
        if (d.gfa > r.maxGFA * 1.0005) problems.push(`${at}: gfa ${d.gfa.toFixed(1)} > maxGFA ${r.maxGFA.toFixed(1)}`)
        if (Math.abs(d.coverage + d.openSpace - r.plotArea) > 0.005 * r.plotArea) problems.push(`${at}: coverage ${d.coverage.toFixed(1)} + open ${d.openSpace.toFixed(1)} != plot ${r.plotArea.toFixed(1)}`)
        const sum = d.floors.reduce((s, f) => s + f.area, 0)
        if (Math.abs(sum - d.gfa) > 0.005 * Math.max(d.gfa, 1)) problems.push(`${at}: floors sum ${sum.toFixed(1)} != gfa ${d.gfa.toFixed(1)}`)
        const open = d.checks.find((c) => c.id === 'open')
        if (open?.status === 'pass' && d.openSpace + 0.01 < d.openRequired) problems.push(`${at}: open-space check passes with ${d.openSpace.toFixed(1)} < ${d.openRequired.toFixed(1)}`)
        for (const f of d.floors) {
          const outside = areaMP(difference(f.mp, [plotRing]))
          if (outside > 0.005 * r.plotArea) { problems.push(`${at}: floor ${f.level} sticks out of the plot by ${outside.toFixed(1)} m²`); break }
        }
        if (d.ok && d.checks.some((c) => c.status === 'fail')) problems.push(`${at}: ok=true but a check fails`)
      }
    }
    console.log(`fuzz: ${designsSeen} designs checked, ${nullResults} null results, ${errors} PlotErrors, slowest ${slowest.toFixed(0)} ms [${slowestTag}], ${problems.length} problems`)
    expect(problems.slice(0, 20)).toEqual([])
  }, 60000)
})
