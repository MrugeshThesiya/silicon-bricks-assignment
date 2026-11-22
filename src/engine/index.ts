import { Frame, type XY } from '../geo/frame'
import {
  areaMP, capsule, clipHalfPlane, closeRing, dedupeRing, difference, isSimple, openRing, polyOf, shrinkToArea, toCCW,
  type MP, type Ring,
} from '../geo/poly'
import { HIGH_RISE_HEIGHT, ZONES, type ZoneId } from '../rules/zones'
import {
  ROOM_AREA, ROWS, SHOP_FLOORS, USES, commerceMaxArea, hotelMaxRooms, housingMaxArea, officeMaxArea, type Access, type UseId,
} from '../rules/uses'
import { layoutRows, type RowLayout } from './rows'
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
  /** Building type. Default: condominium. */
  use?: UseId
}

export type Edge = { a: XY; b: XY; length: number; n: XY }
export type Plane = { a: XY; n: XY; width: number }
export type Floor = { level: number; base: number; top: number; mp: MP; area: number }
export type Check = { id: string; rule: string; label: string; status: 'pass' | 'fail' | 'info'; detail: string }
export type Slice = { base: number; top: number; mp: MP; area: number }

export type Design = {
  id: 'low' | 'tower' | 'podium' | 'rows'
  use: UseId
  /** Numbers that matter for this building type (rooms, office area, shop area ...). */
  stats: { label: string; value: string }[]
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
  use: UseId
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

/** Height of one slice of the drawn envelope. Finer than a floor, so the road height limit shows as a smooth slope. */
export const ENVELOPE_STEP = 0.8

function buildSlices(env: MP, plane: Plane, step: number, maxTop: number): Slice[] {
  const out: Slice[] = []
  for (let k = 1; k * step <= maxTop + 1e-6; k++) {
    const top = k * step
    const mp = allowedAt(env, plane, top)
    const area = areaMP(mp)
    if (area < 1) break
    const last = out[out.length - 1]
    if (last && Math.abs(last.area - area) < 0.05) last.top = top
    else out.push({ base: (k - 1) * step, top, mp, area })
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
  use: UseId
  /** The plan's road and station tests for this site (R-54). */
  access: Access
  plotMP: MP
  /** Highest floor count that stays under 23 m at this floor height. */
  maxLow: number
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
  const openRequired = Math.max(zone.osr * gfa, lawMinOpenSpace(regime, ctx.plotArea, largest, USES[ctx.use].housing))
  const openSpace = ctx.plotArea - coverage
  return { gfa, height, largest, coverage, regime, openRequired, openSpace }
}

/** Floor area of the lowest `shop` floors: the shop (operating) area of a mixed-use or shophouse design (A-17, A-20). */
const shopArea = (floors: Floor[], shop: number) => floors.slice(0, shop).reduce((t, f) => t + f.area, 0)

function evaluate(ctx: Ctx, floors: Floor[], shop = 0, rows?: RowLayout): Check[] {
  const m = measure(ctx, floors)
  const housing = USES[ctx.use].housing
  const commerce = shopArea(floors, shop)
  const zone = ZONES[ctx.zone]
  const env = m.regime === 'high' ? ctx.envHigh : ctx.envLow
  const checks: Check[] = []

  checks.push({
    id: 'far', rule: 'R-01..R-03', label: 'Floor area ratio',
    status: m.gfa <= ctx.maxGFA + 0.01 ? 'pass' : 'fail',
    detail: `${fmt(m.gfa)} m² of ${fmt(ctx.maxGFA)} m² allowed (FAR ${(m.gfa / ctx.plotArea).toFixed(2)} of ${zone.far})`,
  })

  checks.push({
    id: 'open', rule: m.regime === 'high' ? 'R-36' : housing ? 'R-10' : 'R-56', label: 'Open space',
    status: m.openSpace + 0.01 >= m.openRequired ? 'pass' : 'fail',
    detail: `${fmt(m.openSpace)} m² open, ${fmt(m.openRequired)} m² needed (OSR ${(zone.osr * 100).toFixed(1)} % of floor area, or ${
      housing ? '30' : '10'
    } % of ${m.regime === 'high' ? 'plot' : 'largest floor'})`,
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

  // R-40: multi-unit housing over 10,000 m². In a mixed-use building only the housing part counts.
  const housingArea = ctx.use === 'condo' ? m.gfa : ctx.use === 'mixed' || ctx.use === 'rows' ? m.gfa - commerce : 0
  if (housingArea > 10000) {
    const ok = ctx.access.station || ctx.access.road(30)
    checks.push({
      id: 'large', rule: 'R-40', label: 'Over 10,000 m² of housing',
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'Allowed: near a station, or on a road 30 m wide with a 30 m plot side' : 'Needs a station within 500 m, or a road 30 m wide or more with a plot side of 30 m or more',
    })
  }

  if (ctx.use === 'hotel') {
    const rooms = Math.floor(m.gfa / ROOM_AREA), max = hotelMaxRooms(ctx.zone, ctx.access)
    checks.push({
      id: 'hotel', rule: 'R-50', label: 'Hotel size',
      status: rooms <= max ? 'pass' : 'fail',
      detail: `${rooms} rooms (${ROOM_AREA} m² each). ${Number.isFinite(max) ? `At most ${max} rooms here` : 'No room limit here'}: more than 50 rooms needs a road 16 m wide (30 m for over 80 rooms in Y.5 and Y.6) or a station within 500 m`,
    })
  }
  if (ctx.use === 'office') {
    const max = officeMaxArea(ctx.zone, ctx.access)
    checks.push({
      id: 'office', rule: 'R-53', label: 'Office size',
      status: m.gfa <= max + 0.01 ? 'pass' : 'fail',
      detail: `${fmt(m.gfa)} m² of offices; at most ${fmt(max)} m² here. Larger offices need a wider road or a station within 500 m, and above the top limit the plan prohibits them`,
    })
  }
  if (commerce > 0) {
    const max = commerceMaxArea(ctx.zone, ctx.access)
    checks.push({
      id: 'shops', rule: 'R-52', label: 'Shop floor area',
      status: commerce <= max + 0.01 ? 'pass' : 'fail',
      detail: `${fmt(commerce)} m² of shops; ${Number.isFinite(max) ? `at most ${fmt(max)} m² here` : 'no limit here'}`,
    })
  }
  if (rows) {
    const longest = Math.max(...rows.rows.map((r) => r.length)), most = Math.max(...rows.rows.map((r) => r.units))
    checks.push({
      id: 'unit', rule: 'R-55a', label: 'Unit size',
      status: rows.unitWidth >= ROWS.minUnitWidth && rows.depth <= ROWS.maxDepth && rows.unitArea >= ROWS.minUnitArea ? 'pass' : 'fail',
      detail: `Units ${rows.unitWidth} m wide (at least ${ROWS.minUnitWidth} m), ${rows.depth} m deep (at most ${ROWS.maxDepth} m, no inner court needed up to 16 m), ${fmt(rows.unitArea)} m² on the ground floor (at least ${ROWS.minUnitArea} m²)`,
    })
    checks.push({
      id: 'row', rule: 'R-55b', label: 'Row length',
      status: most <= ROWS.maxUnitsPerRow && longest <= ROWS.maxRowLength + 0.01 ? 'pass' : 'fail',
      detail: `${rows.rows.length} row${rows.rows.length === 1 ? '' : 's'}, ${rows.units} units in all; the longest row has ${most} units and is ${longest} m long (at most ${ROWS.maxUnitsPerRow} units and ${ROWS.maxRowLength} m)`,
    })
    checks.push({
      id: 'rear', rule: 'R-55c', label: 'Space behind, between and beside the rows',
      status: rows.rearOk ? 'pass' : 'fail',
      detail: `At least ${ROWS.rear} m open behind each row, ${ROWS.gap} m between rows, and 2 m or more from a neighbour's boundary (the front faces the road, so no 6 m front space is needed)`,
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

function statsFor(ctx: Ctx, floors: Floor[], shop: number): Design['stats'] {
  const gfa = floors.reduce((t, f) => t + f.area, 0), commerce = shopArea(floors, shop)
  if (ctx.use === 'hotel') return [{ label: `Hotel rooms (${ROOM_AREA} m² each)`, value: fmt(Math.floor(gfa / ROOM_AREA)) }]
  if (ctx.use === 'office') return [{ label: 'Office floor area', value: `${fmt(gfa)} m²` }]
  if (ctx.use === 'mixed' || ctx.use === 'rows')
    return [
      { label: 'Shop floor area', value: `${fmt(commerce)} m²` },
      { label: 'Housing floor area', value: `${fmt(gfa - commerce)} m²` },
    ]
  return []
}

function finish(ctx: Ctx, id: Design['id'], name: string, blurb: string, floors: Floor[], shop = 0, rows?: RowLayout): Design {
  const m = measure(ctx, floors)
  const checks = evaluate(ctx, floors, shop, rows)
  return {
    id, use: ctx.use, stats: statsFor(ctx, floors, shop), name, blurb, regime: m.regime, floors, gfa: m.gfa, height: m.height, coverage: m.coverage,
    openSpace: m.openSpace, openRequired: m.openRequired, checks,
    ok: checks.every((c) => c.status !== 'fail'),
  }
}

/** Shrink the footprint in steps until the open-space rule (and `ok`, if given) holds. */
function fit(ctx: Ctx, env: () => MP, startArea: number, maxFloors: number, ok?: (floors: Floor[]) => boolean, shop = 0): Floor[] {
  let target = startArea
  let floors: Floor[] = []
  for (let i = 0; i < 30; i++) {
    const e = env()
    if (areaMP(e) < 20) return []
    const fp = shrinkToArea(e, target)
    floors = stackFloors(fp, ctx.plane, ctx.floorH, maxFloors, ctx.usableGFA)
    if (!floors.length) return []
    floors = limitHousing(ctx, floors, shop, (t) => stackFloors(fp, ctx.plane, ctx.floorH, maxFloors, t))
    const m = measure(ctx, floors)
    if (m.openSpace + 0.01 >= m.openRequired && (!ok || ok(floors))) return floors
    target *= 0.93
  }
  return floors
}

type Copy = [name: string, blurb: string]

/**
 * In a mixed-use design the housing part (everything above the shop floors) has its own limit (R-40). If it is over,
 * stack again with a lower total, which trims the top floors and leaves the shop floors as they are.
 */
function limitHousing(ctx: Ctx, floors: Floor[], shop: number, restack: (target: number) => Floor[]): Floor[] {
  const cap = housingMaxArea(ctx.access)
  if (!shop || !Number.isFinite(cap)) return floors
  const shops = shopArea(floors, shop)
  const housing = floors.reduce((t, f) => t + f.area, 0) - shops
  return housing > cap ? restack(shops + cap) : floors
}

/** Shops of a mixed-use design must stay within the shop limit (R-52). */
const shopsWithinLimit = (ctx: Ctx, shop: number) => (floors: Floor[]) => shopArea(floors, shop) <= commerceMaxArea(ctx.zone, ctx.access) + 0.01

function makeLowRise(ctx: Ctx, copy: Copy, shop = 0): Design | null {
  const ok = shop ? shopsWithinLimit(ctx, shop) : undefined
  let floors = fit(ctx, () => ctx.envLow, Math.min(areaMP(ctx.envLow), ctx.plotArea / 1.3), ctx.maxLow, ok, shop)
  if (floors.length && measure(ctx, floors).regime === 'high')
    floors = fit(ctx, () => ctx.envHigh, Math.min(areaMP(ctx.envHigh), ctx.plotArea * 0.7), ctx.maxLow, ok, shop)
  if (!floors.length) return null
  return finish(ctx, 'low', copy[0], copy[1], floors, shop)
}

function makeTower(ctx: Ctx, copy: Copy): Design | null {
  if (ctx.plane.width < 10) return null // R-30: a high-rise needs a road at least 10 m wide
  const start = Math.min(areaMP(ctx.envHigh), Math.max(150, ctx.maxGFA / 16))
  const floors = fit(ctx, () => ctx.envHigh, start, 60)
  if (!floors.length) return null
  return finish(ctx, 'tower', copy[0], copy[1], floors)
}

/** Shophouse rows along the road edge (R-55, A-21). */
function makeRows(ctx: Ctx): Design | null {
  const layout = layoutRows(ctx.envLow, ctx.plotMP, ctx.edges[ctx.roadEdge])
  if (!layout) return null
  const floors = stackFloors(layout.footprint, ctx.plane, ctx.floorH, ROWS.floors, ctx.usableGFA)
  if (!floors.length) return null
  return finish(
    ctx, 'rows', 'Shophouse rows',
    `Rows of ${layout.unitWidth} m wide units along the road, ${ROWS.floors} floors: shops on the ground floor, homes above. The rest of the plot stays open for the space behind and between the rows.`,
    floors, 1, layout,
  )
}

/** The plot cannot be used as drawn (for example its edges cross). The message is shown to the user. */
export class PlotError extends Error {}

const PODIUM_FLOORS = 4

/** A wide podium with a slimmer tower on top. The podium is kept inside the 6 m setback, because the whole building is a high-rise (A-07). */
function makePodiumTower(ctx: Ctx, copy: Copy, shop = 0): Design | null {
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
    floors = limitHousing(ctx, [...podium, ...tower], shop, (t) => [
      ...podium,
      ...stackFloors(towerFp, ctx.plane, ctx.floorH, 60 - PODIUM_FLOORS, t - used, true, podium.length),
    ])
    const m = measure(ctx, floors)
    if (m.openSpace + 0.01 >= m.openRequired && (!shop || shopsWithinLimit(ctx, shop)(floors))) break
    podiumArea *= 0.93
    towerArea *= 0.93
  }
  if (floors.length <= PODIUM_FLOORS) return null // no tower part: same as a low-rise
  return finish(ctx, 'podium', copy[0], copy[1], floors, shop)
}

/** Names and one-line descriptions of the designs, by building type. */
const COPY: Record<Exclude<UseId, 'rows'>, { low: Copy; tower?: Copy; podium: Copy }> = {
  condo: {
    low: ['Low-rise block', 'Wide and low, kept under 23 m so only the building rules for lower buildings apply.'],
    tower: ['Tower', 'Slim and tall on a small footprint, with 6 m clear on every side and more open space.'],
    podium: ['Podium + tower', 'A wide four-storey podium with a tower on part of it. More of the floor area sits low, so the tower is shorter than in the slim tower design.'],
  },
  hotel: {
    low: ['Low-rise hotel', 'A wide hotel block kept under 23 m, so only the building rules for lower buildings apply.'],
    tower: ['Hotel tower', 'A slim hotel tower with 6 m clear on every side.'],
    podium: ['Hotel with podium', 'A four-storey podium (lobby, restaurants, meeting rooms) with the room tower above.'],
  },
  office: {
    low: ['Low-rise office block', 'A wide office block kept under 23 m (6 floors at 3.8 m).'],
    tower: ['Office tower', 'A slim office tower with 6 m clear on every side.'],
    podium: ['Office podium + tower', 'A four-storey podium with the office tower above.'],
  },
  mixed: {
    low: ['Shops below, flats above (low-rise)', 'Shops on the two lowest floors and flats above, kept under 23 m.'],
    podium: ['Retail podium + condominium tower', 'Shops fill the three lowest floors of a wide podium; the condominium tower stands above.'],
  },
}

/** `floorHOverride` is for tests; normally the floor height comes from the building type (A-19). */
export function compute(input: Input, floorHOverride?: number): Result | null {
  if (input.plot.length < 4) return null
  const ll = dedupeRing(openRing(input.plot as Ring))
  if (ll.length < 3) return null
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

  const use: UseId = input.use ?? 'condo'
  const floorH = floorHOverride ?? USES[use].floorH
  const maxLow = Math.floor((HIGH_RISE_HEIGHT - 0.01) / floorH) // floors that stay under 23 m
  const zone = ZONES[input.zone]
  const maxGFA = zone.far * plotArea

  // The plan's road and station tests (R-54, A-18): a plot side of 12 / 16 / 30 m on a road at least as wide, or a station within 500 m.
  const access: Access = {
    station: input.nearStation,
    road: (x) => roads.some((r) => r.width >= x && edges[r.edge].length >= x),
  }

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
  // Use limits (R-40, R-50, R-52, R-53). Each cap is the most the plan allows for this use on this site.
  const cap = (limit: number, why: string) => {
    if (Number.isFinite(limit) && usableGFA > limit) {
      usableGFA = limit
      notes.push(why)
    }
  }
  if (use === 'condo') cap(housingMaxArea(access), 'No station within 500 m and no road 30 m wide with a 30 m plot side: housing over 10,000 m² is not allowed (R-40), so floor area is kept under 10,000 m².')
  if (use === 'hotel') {
    const rooms = hotelMaxRooms(input.zone, access)
    cap(rooms * ROOM_AREA, `Hotel: with no station within 500 m and a road this narrow, the plan allows at most ${rooms} rooms (R-50), so floor area is kept to about ${fmt(rooms * ROOM_AREA)} m² (${ROOM_AREA} m² per room).`)
  }
  if (use === 'office') {
    const area = officeMaxArea(input.zone, access)
    cap(area, `Office: the plan allows at most ${fmt(area)} m² of offices here (R-53). Larger offices need a wider road or a station within 500 m.`)
  }
  if (use === 'mixed') cap(commerceMaxArea(input.zone, access) + housingMaxArea(access), 'Mixed use: the shop floor area (R-52) and the housing floor area (R-40) are each limited here, which caps the building.')

  const ctx: Ctx = {
    plotArea, plotRing, edges, roadEdge, roads, mainRoad, plane, zone: input.zone, nearStation: input.nearStation, use, access, plotMP, maxLow,
    envLow, envHigh, maxGFA, usableGFA, floorH,
  }

  const designs = (
    use === 'rows'
      ? [makeRows(ctx)]
      : use === 'mixed'
        ? [makeLowRise(ctx, COPY.mixed.low, SHOP_FLOORS.low), makePodiumTower(ctx, COPY.mixed.podium, SHOP_FLOORS.podium)]
        : [makeLowRise(ctx, COPY[use].low), makeTower(ctx, COPY[use].tower!), makePodiumTower(ctx, COPY[use].podium)]
  ).filter((d): d is Design => d !== null)

  if (designs.length === 0 && notes.length === 0) notes.push('No concept design fits the plot and applicable constraints.')

  const fullStack = stackFloors(envHigh, plane, floorH, 60, usableGFA, false) // only the height is needed
  const topFull = fullStack.length ? fullStack[fullStack.length - 1].top : 0
  const topDesigns = designs.reduce((m, d) => Math.max(m, d.height), 0)
  const capHigh = Math.min(150, Math.max(topFull, topDesigns, 25.6))

  return {
    use, frame, plotArea, edges, roadEdge, uses, plane, maxGFA, usableGFA, notes,
    osrMinAtMax: zone.osr * maxGFA,
    setbacks: { road, side: SIDE_SETBACK_LOW, high: SETBACK_HIGH },
    envLow, envHigh,
    slicesLow: buildSlices(envLow, plane, ENVELOPE_STEP, maxLow * floorH),
    slicesHigh: buildSlices(envHigh, plane, ENVELOPE_STEP, capHigh),
    designs,
  }
}
