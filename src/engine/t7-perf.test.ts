// Performance budget (audit task T7). Prints median and p95 of compute() per plot size; the assertion is deliberately loose so a slow CI machine does not fail it.
import { describe, expect, it } from 'vitest'
import { Frame } from '../geo/frame'
import { compute, type Input } from './index'
import { USES, type UseId } from '../rules/uses'

const f = new Frame(100.6063, 13.6982)
const ll = (xy: [number, number][]) => [...xy, xy[0]].map((p) => f.toLL(p))
const four: [number, number][] = [[0, 0], [40, 0], [40, 50], [0, 50]]
// 12 vertices: a plot with a notch on each long side.
const twelveNotched: [number, number][] = [[0, 0], [20, 0], [20, 6], [40, 6], [40, 0], [60, 0], [60, 40], [40, 40], [40, 34], [20, 34], [20, 40], [0, 40]]
// 30 vertices: a circle-ish blob.
const thirty: [number, number][] = Array.from({ length: 30 }, (_, i) => {
  const t = (i / 30) * 2 * Math.PI, r = 25 + (i % 2) * 3
  return [r * Math.cos(t), r * Math.sin(t)]
})

const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))]

describe('compute() speed', () => {
  const uses = Object.keys(USES) as UseId[]
  it.each([['4 vertices', four], ['12 vertices (notched)', twelveNotched], ['30 vertices', thirty]] as const)('%s', (name, xy) => {
    const times: number[] = []
    for (let run = 0; run < 20; run++) {
      for (const use of uses) {
        const input: Input = { plot: ll([...xy]), zone: 'Y.7', roadEdge: 0, roadWidth: 12, nearStation: true, use }
        const t0 = performance.now()
        compute(input)
        times.push(performance.now() - t0)
      }
    }
    const med = pct(times, 0.5), p95 = pct(times, 0.95)
    console.log(`perf ${name}: median ${med.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, max ${Math.max(...times).toFixed(0)} ms (${times.length} runs)`)
    expect(p95).toBeLessThan(1000)
  }, 120000)
})
