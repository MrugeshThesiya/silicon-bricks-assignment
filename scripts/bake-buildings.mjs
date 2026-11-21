// Bakes a small, offline fallback copy of the OpenStreetMap building footprints around the example plot.
// Usage: node scripts/bake-buildings.mjs
// Data: (c) OpenStreetMap contributors, ODbL 1.0.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { VectorTile } from '@mapbox/vector-tile'
import * as PbfNs from 'pbf'

const Pbf = PbfNs.default ?? PbfNs.Pbf ?? Object.values(PbfNs)[0]

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = path.join(ROOT, 'public', 'data')
const OUT_FILE = path.join(OUT_DIR, 'buildings.geojson')
const EXAMPLE_PATH = path.join(ROOT, 'src', 'example.ts')

const exampleSrc = fs.readFileSync(EXAMPLE_PATH, 'utf8')
const jMatch = exampleSrc.match(/const J = \{ lon: ([\d.]+), lat: ([\d.]+) \}/)
if (!jMatch) throw new Error('could not parse J')
const J_LON = +jMatch[1], J_LAT = +jMatch[2]
const uMatch = exampleSrc.match(/const U = \[([\d.]+) \/ L, ([\d.]+) \/ L\]/)
if (!uMatch) throw new Error('could not parse U')
const a = +uMatch[1], b = +uMatch[2]
const L = Math.hypot(a, b)
const U = [a / L, b / L]
const V = [-U[1], U[0]]
const centerMatch = exampleSrc.match(/center:\s*at\(([^,]+),\s*([^)]+)\)/)
if (!centerMatch) throw new Error('could not parse center')
const cu = +centerMatch[1], cv = +centerMatch[2]
const KX = 111320 * Math.cos((J_LAT * Math.PI) / 180)
const KY = 110574
const r7 = (n) => Math.round(n * 1e7) / 1e7
const CENTRE = [r7(J_LON + (cu * U[0] + cv * V[0]) / KX), r7(J_LAT + (cu * U[1] + cv * V[1]) / KY)]
console.log('centre (from src/example.ts):', CENTRE[1], 'N,', CENTRE[0], 'E')

const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
const USER_AGENT = 'bangkok-plot-planner-bake/1.0'
const ZOOM = 14
const RADIUS_M = 2000

const M_PER_DEG_LON = 111320 * Math.cos((CENTRE[1] * Math.PI) / 180)
const M_PER_DEG_LAT = 110574

const MAX_BYTES = 3 * 1024 * 1024
const ATTEMPTS = [
  { decimals: 6, radius: RADIUS_M },
  { decimals: 5, radius: RADIUS_M },
  { decimals: 5, radius: 1500 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const get = async (url, accept) => {
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept } })
      if (r.ok) return r
      lastErr = new Error('HTTP ' + r.status)
      if (r.status !== 429 && r.status < 500) break
    } catch (err) {
      lastErr = err
    }
    await sleep(1000)
  }
  throw lastErr
}

const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const ty = (lat, z) => {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

const round = (v, decimals) => {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

const geomBBox = (geom) => {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  return Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : null
}

const roundGeom = (geom, decimals) => {
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map((r) => r.map((c) => [round(c[0], decimals), round(c[1], decimals)])) }
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map((p) => p.map((r) => r.map((c) => [round(c[0], decimals), round(c[1], decimals)]))) }
}

const bboxDistanceM = ([minLon, minLat, maxLon, maxLat]) => {
  const dLon = Math.max(minLon - CENTRE[0], 0, CENTRE[0] - maxLon) * M_PER_DEG_LON
  const dLat = Math.max(minLat - CENTRE[1], 0, CENTRE[1] - maxLat) * M_PER_DEG_LAT
  return Math.hypot(dLon, dLat)
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n)

// TileJSON
const tilejsonRes = await get(TILEJSON_URL, 'application/json')
const tilejson = await tilejsonRes.json()
const template = tilejson.tiles?.[0]
if (!template || !template.includes('{z}')) throw new Error('TileJSON has no tile template')
const tileVersion = template.match(/\/([^/]+)\/\{z\}\/\{x\}\/\{y\}/)?.[1] ?? 'unknown'
console.log('tile template:', template)
console.log('tile version:', tileVersion)

// tiles covering circle
const lonMin = CENTRE[0] - RADIUS_M / M_PER_DEG_LON
const lonMax = CENTRE[0] + RADIUS_M / M_PER_DEG_LON
const latMin = CENTRE[1] - RADIUS_M / M_PER_DEG_LAT
const latMax = CENTRE[1] + RADIUS_M / M_PER_DEG_LAT
const x0 = tx(lonMin, ZOOM), x1 = tx(lonMax, ZOOM)
const y0 = ty(latMax, ZOOM), y1 = ty(latMin, ZOOM)
const jobs = []
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push({ x, y })
console.log('centre:', CENTRE[1], 'N,', CENTRE[0], 'E; radius', RADIUS_M, 'm;', jobs.length, 'tiles at z' + ZOOM)

const rawParts = []
const perFeatureStats = []
const stats = { ok: 0, empty: 0, failed: [], noBuildingLayer: [] }

const one = async ({ x, y }) => {
  const url = template.replace('{z}', ZOOM).replace('{x}', x).replace('{y}', y)
  let buf
  try {
    const r = await get(url, 'application/x-protobuf')
    buf = Buffer.from(await r.arrayBuffer())
  } catch (err) {
    stats.failed.push({ x, y, error: String(err?.message ?? err) })
    console.log('  tile', x, '/', y, 'failed', err?.message ?? err)
    return
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf)
  let tile
  try {
    tile = new VectorTile(new Pbf(buf))
  } catch (err) {
    stats.failed.push({ x, y, error: 'decode: ' + (err?.message ?? err) })
    console.log('  tile', x, '/', y, 'decode failed')
    return
  }
  const layer = tile.layers.building
  if (!layer) { stats.noBuildingLayer.push({ x, y }); return }
  if (layer.length === 0) { stats.empty++; return }

  let keptFeatures = 0
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i)
    const geom = f.toGeoJSON(x, y, ZOOM).geometry
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
    const totalParts = polys.length
    let kept = 0
    for (const poly of polys) {
      const partGeom = { type: 'Polygon', coordinates: poly }
      const bb = geomBBox(partGeom)
      if (!bb) continue
      if (bboxDistanceM(bb) > RADIUS_M) continue
      const p = f.properties
      rawParts.push({
        id: f.id,
        h: finite(p.render_height) ? p.render_height : 5,
        b: finite(p.render_min_height) ? p.render_min_height : 0,
        poly,
      })
      kept++
    }
    perFeatureStats.push({ x, y, index: i, id: f.id, total: totalParts, kept })
    if (kept > 0) keptFeatures++
  }
  stats.ok++
  console.log('  tile', x, '/', y, ':', layer.length, 'features,', keptFeatures, 'with parts inside circle')
}

const queue = jobs.slice()
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      await one(queue.shift())
      await sleep(250)
    }
  }),
)

const build = ({ decimals, radius }) => {
  const seen = new Set()
  const out = []
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const rp of rawParts) {
    const partGeom = { type: 'Polygon', coordinates: rp.poly }
    const bb = geomBBox(partGeom)
    if (!bb) continue
    if (bboxDistanceM(bb) > radius) continue
    const geom = roundGeom({ type: 'Polygon', coordinates: rp.poly }, decimals)
    const bbox = geomBBox(geom)
    if (!bbox) continue
    const feature = { type: 'Feature', ...(rp.id === undefined ? {} : { id: rp.id }), properties: { h: rp.h, b: rp.b }, geometry: geom }
    const key = JSON.stringify(feature)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(feature)
    if (bbox[0] < minLon) minLon = bbox[0]
    if (bbox[1] < minLat) minLat = bbox[1]
    if (bbox[2] > maxLon) maxLon = bbox[2]
    if (bbox[3] > maxLat) maxLat = bbox[3]
  }
  const fc = {
    type: 'FeatureCollection',
    bbox: [minLon, minLat, maxLon, maxLat],
    metadata: {
      source: 'OpenStreetMap building footprints via OpenFreeMap / OpenMapTiles vector tiles',
      license: 'ODbL 1.0',
      attribution: '(c) OpenStreetMap contributors',
      extractionDate: new Date().toISOString(),
      tileVersion,
      tileUrlTemplate: template,
      zoom: ZOOM,
      centre: CENTRE,
      radiusMetres: radius,
      coordinateDecimals: decimals,
      featureCount: out.length,
    },
    features: out,
  }
  const text = JSON.stringify(fc)
  return { text, fc, bytes: Buffer.byteLength(text) }
}

let chosen
for (const attempt of ATTEMPTS) {
  chosen = build(attempt)
  const mb = (chosen.bytes / 1024 / 1024).toFixed(2)
  console.log('decimals', attempt.decimals, ', radius', attempt.radius, 'm:', chosen.fc.metadata.featureCount, 'features,', mb, 'MB')
  if (chosen.bytes < MAX_BYTES) break
}
if (chosen.bytes >= MAX_BYTES) {
  console.warn('warning: still', (chosen.bytes / 1024 / 1024).toFixed(2), 'MB, above 3 MB budget')
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_FILE, chosen.text)

const gzipBytes = zlib.gzipSync(Buffer.from(chosen.text)).length
const m = chosen.fc.metadata
const idCounts = new Map()
for (const f of chosen.fc.features) {
  const id = f.id
  idCounts.set(id, (idCounts.get(id) || 0) + 1)
}
let maxPartsPerId = 0, maxId = null
for (const [id, c] of idCounts) if (c > maxPartsPerId) { maxPartsPerId = c; maxId = id }
let largestBboxM = 0, maxBbox = null
for (const f of chosen.fc.features) {
  const b = geomBBox(f.geometry)
  const w = (b[2] - b[0]) * M_PER_DEG_LON
  const h = (b[3] - b[1]) * M_PER_DEG_LAT
  const diag = Math.hypot(w, h)
  if (diag > largestBboxM) { largestBboxM = diag; maxBbox = b }
}
console.log('---')
console.log('wrote', path.relative(ROOT, OUT_FILE))
console.log('features', m.featureCount, ', decimals', m.coordinateDecimals, ', radius', m.radiusMetres, 'm')
console.log('size', (chosen.bytes / 1024).toFixed(0), 'KiB raw,', (gzipBytes / 1024).toFixed(0), 'KiB gzip')
console.log('tiles ok', stats.ok, ', empty', stats.empty, ', no building layer', stats.noBuildingLayer.length, ', failed', stats.failed.length)
console.log('distinct ids', idCounts.size, ', max parts sharing one id', maxPartsPerId, '(id', maxId, ')')
console.log('largest feature bbox diagonal', largestBboxM.toFixed(1), 'm (bbox', maxBbox, ')')
console.log('raw tile features', perFeatureStats.length, ', total parts seen', rawParts.length)
const multi = perFeatureStats.filter((s) => s.total > 1)
console.log('tile features with >1 part:', multi.length, 'of', perFeatureStats.length)
if (multi.length) {
  const maxTotal = Math.max(...multi.map((s) => s.total))
  console.log('max parts in one tile feature:', maxTotal)
  multi.sort((a, b) => b.total - a.total).slice(0, 5).forEach((s) => console.log('   tile', s.x, '/', s.y, 'feat#' + s.index, 'id=' + s.id + ':', s.total, 'parts ->', s.kept, 'kept'))
}
if (stats.failed.length) for (const f of stats.failed) console.log('  failed', f.x, '/', f.y, ':', f.error)
