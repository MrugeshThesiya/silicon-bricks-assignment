import { Frame, type XY } from '../geo/frame'
import {
  areaMP, capsule, clipHalfPlane, closeRing, difference, isSimple, openRing, polyOf, shrinkToArea, toCCW,
  type MP, type Ring,
} from '../geo/poly'
import { FLOOR_HEIGHT, MAX_LOW_FLOORS, ZONES, type ZoneId } from '../rules/zones'
import {
  MAX_LENGTH_NARROW_ROAD, SETBACK_HIGH, SIDE_SETBACK_LOW, canalSetback, lawMinOpenSpace, minRoadWidthHigh, regimeFor,
  roadSetbackLow, type Regime,
} from '../rules/setbacks'

/** What a plot edge borders when it is not a neighbour: another road, or a canal (A-13, A-14). */
export type EdgeUse = { kind: 'road' | 'canal'; width: number }

export type Input = {
  /** Outer ring of the drawn plot, [lon, lat]. */
  plot: [number, number][]
  zone: ZoneId
  /** Index of the plot edge that faces the road, after the ring is made counter-clockwise. Null = longest edge. */
  roadEdge: number | null
  /** Right-of-way width of that road in metres (A-05). */
  roadWidth: number
  /** Plot is within 500 m of a mass-transit station (A-10). */
  nearStation: boolean
  /** Other edges that border a road or a canal, by edge index. Edges not listed border a neighbour. */
  extra?: Record<number, EdgeUse>
}

export type Edge = { a: XY; b: XY; length: number; n: XY }
export type Plane = { a: XY; n: XY; width: number }
export type Floor = { level: number; base: number; top: number; mp: MP; area: number }
export type Check = { id: string; rule: string; label: string; status: 'pass' | 'fail' | 'info'; detail: string }
export type Slice = { base: number; top: number; mp: MP; area: number }

export type Design = {
  id: 'low' | 'tower' | 'podium'
  name: string
  blurb: string
  regime: Regime
  floors: Floor[]
  gfa: number
  height: number
  coverage: number
  openSpace: number
  openRequired: number
  checks: Check[]
  ok: boolean
}

export type Result = {
  frame: Frame
  plotArea: number
  edges: Edge[]
  roadEdge: number
  /** What each edge borders; null is a neighbour. The edge facing the road is listed as a road. */
  uses: (EdgeUse | null)[]
  /** Height plane: from the widest road (R-21, R-22, A-08). */
  plane: Plane
  maxGFA: number
  /** Floor area we aim for: the FAR limit, lowered where the road or station rules would otherwise fail. */
  usableGFA: number
  notes: string[]
  osrMinAtMax: number
  setbacks: { road: number; side: number; high: number }
  envLow: MP
  envHigh: MP
  slicesLow: Slice[]
  slicesHigh: Slice[]
  designs: Design[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function makeEdges(ring: Ring): Edge[] {
  const r = openRing(ring)
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const length = Math.hypot(dx, dy)
    return { a, b, length, n: [-dy / length, dx / length] as XY } // left normal = into a CCW polygon
  })
}

/** Part of `mp` that a floor topping out at `top` metres may occupy under the road height plane (R-20). */
function allowedAt(mp: MP, plane: Plane, top: number): MP {
  return clipHalfPlane(mp, plane.a, plane.n, top / 2 - plane.width)
}

/** `trimLast: false` skips shrinking the top floor to the exact target; the floor count and heights are the same. */
/** `startLevel` stacks on top of floors already placed below (so heights continue from there). */
export function stackFloors(footprint: MP, plane: Plane | null, floorH: number, maxFloors: number, targetGFA: number, trimLast = true, startLevel = 0): Floor[] {
  const floors: Floor[] = []
  let gfa = 0
  for (let k = startLevel + 1; k <= startLevel + maxFloors; k++) {
    const top = k * floorH
    let region = plane ? allowedAt(footprint, plane, top) : footprint
    let area = areaMP(region)
    if (area < 1) break
    const remaining = targetGFA - gfa
    if (remaining < 20) break
    if (trimLast && area > remaining) {
      region = shrinkToArea(region, remaining)
      area = areaMP(region)
    }
    floors.push({ level: k, base: (k - 1) * floorH, top, mp: region, area })
    gfa += area
  }
  return floors
}

function buildSlices(env: MP, plane: Plane, floorH: number, maxTop: number): Slice[] {
  const out: Slice[] = []
  for (let k = 1; k * floorH <= maxTop + 1e-6; k++) {
    const top = k * floorH
    const mp = allowedAt(env, plane, top)
    const area = areaMP(mp)
    if (area < 1) break
    const last = out[out.length - 1]
    if (last && Math.abs(last.area - area) < 0.05) last.top = top
    else out.push({ base: (k - 1) * floorH, top, mp, area })
  }
  return out
}

type Ctx = {
  plotArea: number
  plotRing: Ring
  edges: Edge[]
  roadEdge: number
  /** Edges that border a road, with the road width. */
  roads: { edge: number; width: number }[]
  /** The road whose width sets the height plane. */
  mainRoad: number
  plane: Plane
  zone: ZoneId
  nearStation: boolean
  envLow: MP
  envHigh: MP
  maxGFA: number
  usableGFA: number
  floorH: number
}

function measure(ctx: Ctx, floors: Floor[]) {
  const gfa = floors.reduce((s, f) => s + f.area, 0)
  const height = floors.length ? floors[floors.length - 1].top : 0
  const largest = floors.reduce((m, f) => Math.max(m, f.area), 0)
  const coverage = floors.length ? floors[0].area : 0
  const regime = regimeFor(height, gfa, largest)
  const zone = ZONES[ctx.zone]
  const openRequired = Math.max(zone.osr * gfa, lawMinOpenSpace(regime, ctx.plotArea, largest))
  const openSpace = ctx.plotArea - coverage
  return { gfa, height, largest, coverage, regime, openRequired, openSpace }
}

function evaluate(ctx: Ctx, floors: Floor[]): Check[] {
  const m = measure(ctx, floors)
  const zone = ZONES[ctx.zone]
  const env = m.regime === 'high' ? ctx.envHigh : ctx.envLow
  const checks: Check[] = []

  checks.push({
    id: 'far', rule: 'R-01..R-03', label: 'Floor area ratio',
    status: m.gfa <= ctx.maxGFA + 0.01 ? 'pass' : 'fail',
    detail: `${fmt(m.gfa)} m² of ${fmt(ctx.maxGFA)} m² allowed (FAR ${(m.gfa / ctx.plotArea).toFixed(2)} of ${zone.far})`,
  })

  checks.push({
    id: 'open', rule: m.regime === 'high' ? 'R-36' : 'R-10', label: 'Open space',
    status: m.openSpace + 0.01 >= m.openRequired ? 'pass' : 'fail',
    detail: `${fmt(m.openSpace)} m² open, ${fmt(m.openRequired)} m² needed (OSR ${(zone.osr * 100).toFixed(1)} % of floor area, or ${
      m.regime === 'high' ? '30 % of plot' : '30 % of largest floor'
    })`,
  })

  const outside = floors.length ? areaMP(difference(floors[0].mp, edgesOfEnv(env))) : 0
  checks.push({
    id: 'setbacks', rule: m.regime === 'high' ? 'R-34' : 'R-12..R-16', label: 'Setbacks',
    status: outside < 0.5 ? 'pass' : 'fail',
    detail: m.regime === 'high' ? 'Inside the 6 m setback on all sides' : 'Inside the road and boundary setbacks',
  })

  const worst = floors.reduce((w, f) => Math.max(w, areaMP(difference(f.mp, outsideOfAllowed(ctx, f)))), 0)
  checks.push({
    id: 'height', rule: 'R-20', label: 'Height vs road',
    status: worst < 0.5 ? 'pass' : 'fail',
    detail: `${m.height.toFixed(1)} m tall, limit is twice the distance to the far side of the road`,
  })

  checks.push({
    id: 'regime', rule: 'C art. 1', label: 'Rule set',
    status: 'info',
    detail: m.regime === 'high' ? 'High-rise or special large building: MR 33 and MR 55 apply' : 'Under 23 m: MR 55 applies',
  })

  const narrow = ctx.roads.filter((r) => r.edge !== ctx.mainRoad)
  if (narrow.length && floors.length) {
    const pts = floors.flatMap((f) => f.mp.flatMap((p) => p[0]))
    const longest = narrow.reduce((best, r) => {
      const e = ctx.edges[r.edge]
      const t: XY = [(e.b[0] - e.a[0]) / e.length, (e.b[1] - e.a[1]) / e.length]
      const along = pts.map((q) => (q[0] - e.a[0]) * t[0] + (q[1] - e.a[1]) * t[1])
      return Math.max(best, Math.max(...along) - Math.min(...along))
    }, 0)
    checks.push({
      id: 'corner', rule: 'R-22', label: 'Length along the narrower road',
      status: longest <= MAX_LENGTH_NARROW_ROAD + 0.01 ? 'pass' : 'fail',
      detail: `Building is ${longest.toFixed(1)} m long along the narrower road (at most ${MAX_LENGTH_NARROW_ROAD} m); the height limit uses the wider road`,
    })
  }

  if (m.regime === 'high') {
    const needW = minRoadWidthHigh(m.gfa)
    const good = ctx.roads.filter((r) => ctx.edges[r.edge].length >= 12 && r.width >= needW)
    const shown = good[0] ?? ctx.roads.find((r) => r.edge === ctx.roadEdge)!
    const edge = ctx.edges[shown.edge]
    checks.push({
      id: 'frontage', rule: needW === 18 ? 'R-31' : 'R-30', label: 'Road frontage',
      status: good.length > 0 ? 'pass' : 'fail',
      detail: good.length > 0
        ? `Plot side ${edge.length.toFixed(1)} m (needs 12 m) on a road ${shown.width} m wide (needs ${needW} m)`
        : `No plot side of 12 m or more on a road ${needW} m wide or more (road side ${edge.length.toFixed(1)} m, road ${shown.width} m)`,
    })
    checks.push({
      id: 'fire', rule: 'R-33', label: 'Fire lane',
      status: 'pass',
      detail: 'A 6 m clear strip all round the building is kept by the 6 m setback (assumed to be usable as the lane)',
    })
  }

  if (m.gfa > 10000) {
    const ok = ctx.nearStation || ctx.plane.width >= 30
    checks.push({
      id: 'large', rule: 'R-40', label: 'Over 10,000 m² of housing',
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'Allowed: near a station or on a road 30 m wide or more' : 'Needs a station within 500 m or a road 30 m wide or more',
    })
  }

  checks.push({
    id: 'parking', rule: 'A-09, A-04', label: 'Parking (information)',
    status: 'info',
    detail: `About ${Math.ceil(m.gfa / 120)} spaces at 1 per 120 m² of floor area (figure not confirmed in the regulations). Parking floors count toward the floor area, and basements are not modelled.`,
  })

  checks.push({
    id: 'bonus', rule: 'R-01, art. 50 to 57', label: 'FAR bonus (not modelled)',
    status: 'info',
    detail: `Up to 20 % more floor area (about ${fmt(0.2 * ctx.maxGFA)} m²) is possible through low-income housing, water retention or an energy-efficient building. The checks here use the base FAR.`,
  })

  checks.push({
    id: 'planted', rule: 'R-01', label: 'Planted area',
    status: 'info',
    detail: `At least ${fmt(m.openRequired * 0.5)} m² of the open space must be permeable ground for planting`,
  })
  return checks
}

/** Ring list of the polygon so that `difference(footprint, ...)` removes the allowed envelope. */
function edgesOfEnv(env: MP): Ring[] {
  // Use the envelope itself as the clip: whatever remains is outside the envelope.
  return env.flatMap((p) => [p[0]])
}

function outsideOfAllowed(ctx: Ctx, f: Floor): Ring[] {
  return clipHalfPlane([[closeRing(bigBox())]], ctx.plane.a, ctx.plane.n, f.top / 2 - ctx.plane.width).flatMap((p) => [p[0]])
}
function bigBox(): Ring {
  return [[-4000, -4000], [4000, -4000], [4000, 4000], [-4000, 4000]]
}

function finish(ctx: Ctx, id: Design['id'], name: string, blurb: string, floors: Floor[]): Design {
  const m = measure(ctx, floors)
  const checks = evaluate(ctx, floors)
  return {
    id, name, blurb, regime: m.regime, floors, gfa: m.gfa, height: m.height, coverage: m.coverage,
    openSpace: m.openSpace, openRequired: m.openRequired, checks,
    ok: checks.every((c) => c.status !== 'fail'),
  }
}

/** Shrink the footprint in steps until the open-space rule holds. */
function fit(ctx: Ctx, env: () => MP, startArea: number, maxFloors: number): Floor[] {
  let target = startArea
  let floors: Floor[] = []
  for (let i = 0; i < 30; i++) {
    const e = env()
    if (areaMP(e) < 20) return []
    const fp = shrinkToArea(e, target)
    floors = stackFloors(fp, ctx.plane, ctx.floorH, maxFloors, ctx.usableGFA)
    if (!floors.length) return []
    const m = measure(ctx, floors)
    if (m.openSpace + 0.01 >= m.openRequired) return floors
    target *= 0.93
  }
  return floors
}

function makeLowRise(ctx: Ctx): Design | null {
  let floors = fit(ctx, () => ctx.envLow, Math.min(areaMP(ctx.envLow), ctx.plotArea / 1.3), MAX_LOW_FLOORS)
  if (floors.length && measure(ctx, floors).regime === 'high')
    floors = fit(ctx, () => ctx.envHigh, Math.min(areaMP(ctx.envHigh), ctx.plotArea * 0.7), MAX_LOW_FLOORS)
  if (!floors.length) return null
  return finish(ctx, 'low', 'Low-rise block', 'Wide and low, kept under 23 m so only the building rules for lower buildings apply.', floors)
}

function makeTower(ctx: Ctx): Design | null {
  if (ctx.plane.width < 10) return null // R-30: a high-rise needs a road at least 10 m wide
  const start = Math.min(areaMP(ctx.envHigh), Math.max(150, ctx.maxGFA / 16))
  const floors = fit(ctx, () => ctx.envHigh, start, 60)
  if (!floors.length) return null
  return finish(ctx, 'tower', 'Tower', 'Slim and tall on a small footprint, with 6 m clear on every side and more open space.', floors)
}

/** The plot cannot be used as drawn (for example its edges cross). The message is shown to the user. */
export class PlotError extends Error {}

const PODIUM_FLOORS = 4

/** A wide podium with a slimmer tower on top. The podium is kept inside the 6 m setback, because the whole building is a high-rise (A-07). */
function makePodiumTower(ctx: Ctx): Design | null {
  if (ctx.plane.width < 10) return null // R-30
  const envArea = areaMP(ctx.envHigh)
  if (envArea < 400) return null
  let podiumArea = Math.min(envArea, ctx.plotArea * 0.55)
  let towerArea = podiumArea * 0.6
  let floors: Floor[] = []
  for (let i = 0; i < 30; i++) {
    const podiumFp = shrinkToArea(ctx.envHigh, podiumArea)
    const podium = stackFloors(podiumFp, ctx.plane, ctx.floorH, PODIUM_FLOORS, ctx.usableGFA)
    if (!podium.length) return null
    const used = podium.reduce((s, f) => s + f.area, 0)
    const towerFp = shrinkToArea(podiumFp, towerArea)
    const tower = stackFloors(towerFp, ctx.plane, ctx.floorH, 60 - PODIUM_FLOORS, ctx.usableGFA - used, true, podium.length)
    floors = [...podium, ...tower]
    const m = measure(ctx, floors)
    if (m.openSpace + 0.01 >= m.openRequired) break
    podiumArea *= 0.93
    towerArea *= 0.93
  }
  if (floors.length <= PODIUM_FLOORS) return null // no tower part: same as a low-rise
  return finish(ctx, 'podium', 'Podium + tower', 'A wide four-storey podium with a tower on part of it. More of the floor area sits low, so the tower is shorter than in the slim tower design.', floors)
}

export function compute(input: Input, floorH = FLOOR_HEIGHT): Result | null {
  if (input.plot.length < 4) return null
  const ll = openRing(input.plot as Ring)
  if (!isSimple(ll)) throw new PlotError('The plot outline crosses itself. Move a corner so the edges do not cross.')
  const lon0 = ll.reduce((s, p) => s + p[0], 0) / ll.length
  const lat0 = ll.reduce((s, p) => s + p[1], 0) / ll.length
  const frame = new Frame(lon0, lat0)
  const plotRing = toCCW(ll.map((p) => frame.toXY(p)))
  const plotMP = polyOf(plotRing)
  const plotArea = areaMP(plotMP)
  if (plotArea < 100) return null

  const edges = makeEdges(plotRing)
  const longest = edges.reduce((best, e, i) => (e.length > edges[best].length ? i : best), 0)
  const roadEdge = input.roadEdge !== null && input.roadEdge < edges.length ? input.roadEdge : longest

  // What each edge borders. The edge facing the road is a road; the others are neighbours unless listed (A-13, A-14).
  const uses: (EdgeUse | null)[] = edges.map((_, i) => {
    if (i === roadEdge) return { kind: 'road', width: input.roadWidth }
    const u = input.extra?.[i]
    return u && Number.isFinite(u.width) && u.width > 0 ? u : null
  })
  const roads = uses.flatMap((u, i) => (u?.kind === 'road' ? [{ edge: i, width: u.width }] : []))
  // The height plane comes from the widest road (R-21, R-22, A-08); on a tie the edge facing the road wins.
  const mainRoad = roads.reduce((best, r) => (r.width > best.width ? r : best), roads.find((r) => r.edge === roadEdge)!).edge
  const plane: Plane = { a: edges[mainRoad].a, n: edges[mainRoad].n, width: uses[mainRoad]!.width }

  const road = roadSetbackLow(input.roadWidth)
  const lowD = uses.map((u) => (!u ? SIDE_SETBACK_LOW : u.kind === 'road' ? roadSetbackLow(u.width) : canalSetback(u.width)))
  const highD = edges.map(() => SETBACK_HIGH)
  const cut = (ds: number[]) =>
    difference(plotMP, edges.flatMap((e, i) => (ds[i] > 0 ? [capsule(e.a, e.b, ds[i])] : [])))
  const envLow = cut(lowD)
  const envHigh = cut(highD)

  const zone = ZONES[input.zone]
  const maxGFA = zone.far * plotArea

  // Aim for the most floor area the rules allow on this road (R-30, R-31, R-40).
  const notes: string[] = []
  let usableGFA = maxGFA
  const W = plane.width // widest road
  if (W < 10 && usableGFA >= 9999) {
    usableGFA = 9999
    notes.push('Road under 10 m wide: no high-rise or special large building (R-30), so floor area is kept under 10,000 m².')
  } else if (W < 18 && usableGFA > 30000) {
    usableGFA = 30000
    notes.push('Road under 18 m wide: a building over 30,000 m² is not allowed (R-31), so floor area is capped at 30,000 m².')
  }
  if (!input.nearStation && W < 30 && usableGFA > 9999) {
    usableGFA = 9999
    notes.push('No station within 500 m and road under 30 m wide: housing over 10,000 m² is not allowed (R-40), so floor area is kept under 10,000 m².')
  }

  const ctx: Ctx = {
    plotArea, plotRing, edges, roadEdge, roads, mainRoad, plane, zone: input.zone, nearStation: input.nearStation,
    envLow, envHigh, maxGFA, usableGFA, floorH,
  }

  const designs = [makeLowRise(ctx), makeTower(ctx), makePodiumTower(ctx)].filter((d): d is Design => d !== null)

  const fullStack = stackFloors(envHigh, plane, floorH, 60, usableGFA, false) // only the height is needed
  const topFull = fullStack.length ? fullStack[fullStack.length - 1].top : 0
  const topDesigns = designs.reduce((m, d) => Math.max(m, d.height), 0)
  const capHigh = Math.min(150, Math.max(topFull, topDesigns, 25.6))

  return {
    frame, plotArea, edges, roadEdge, uses, plane, maxGFA, usableGFA, notes,
    osrMinAtMax: zone.osr * maxGFA,
    setbacks: { road, side: SIDE_SETBACK_LOW, high: SETBACK_HIGH },
    envLow, envHigh,
    slicesLow: buildSlices(envLow, plane, floorH, MAX_LOW_FLOORS * floorH),
    slicesHigh: buildSlices(envHigh, plane, floorH, capHigh),
    designs,
  }
}
