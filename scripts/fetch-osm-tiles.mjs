// Downloads the OpenFreeMap vector tiles for central Bangkok (the tiles the app draws) and keeps stations, buildings and roads.
// Usage: node scripts/fetch-osm-tiles.mjs <work-dir>   (needs `mkdir <work-dir>/tiles`; writes <work-dir>/bkk_osm.json)
// Data: OpenStreetMap contributors, ODbL; tiles by OpenFreeMap / OpenMapTiles.
import fs from 'fs'
import { VectorTile } from '@mapbox/vector-tile'
import * as PbfNs from 'pbf'
import zlib from 'zlib'
const Pbf = PbfNs.default ?? PbfNs.Pbf ?? Object.values(PbfNs)[0]
const Z = 14, VER = '20261115_080022_pt'
const SP = process.argv[2]
const [lon0, lon1, lat0, lat1] = [100.44, 100.72, 13.64, 13.92]
const tx = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z)
const ty = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z)
const xs = [tx(lon0), tx(lon1)], ys = [ty(lat1), ty(lat0)]
const jobs = []
for (let x = xs[0]; x <= xs[1]; x++) for (let y = ys[0]; y <= ys[1]; y++) jobs.push([x, y])
console.log('tiles', jobs.length)
const out = { stations: [], buildings: [], roads: [] }
let done = 0
async function one([x, y]) {
  const file = `${SP}/tiles/${Z}_${x}_${y}.pbf`
  let buf
  if (fs.existsSync(file)) buf = fs.readFileSync(file)
  else {
    const r = await fetch(`https://tiles.openfreemap.org/planet/${VER}/${Z}/${x}/${y}.pbf`)
    if (!r.ok) { console.log('fail', x, y, r.status); return }
    buf = Buffer.from(await r.arrayBuffer())
    fs.writeFileSync(file, buf)
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf)
  const t = new VectorTile(new Pbf(buf))
  const L = t.layers
  if (L.poi) for (let i = 0; i < L.poi.length; i++) {
    const f = L.poi.feature(i); const p = f.properties
    if (p.class === 'railway' || p.subclass === 'station' || p.subclass === 'subway' || p.class === 'subway')
      out.stations.push({ name: p['name:latin'] || p.name, name_th: p.name, cls: p.class, sub: p.subclass, g: f.toGeoJSON(x, y, Z).geometry.coordinates })
  }
  if (L.building) for (let i = 0; i < L.building.length; i++) {
    const f = L.building.feature(i)
    const gj = f.toGeoJSON(x, y, Z)
    out.buildings.push({ id: f.id, h: f.properties.render_height, mh: f.properties.render_min_height, g: gj.geometry, x, y })
  }
  if (L.transportation) for (let i = 0; i < L.transportation.length; i++) {
    const f = L.transportation.feature(i); const gj = f.toGeoJSON(x, y, Z)
    out.roads.push({ c: f.properties.class, sc: f.properties.subclass, br: f.properties.brunnel, g: gj.geometry })
  }
  done++
}
const queue = jobs.slice()
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) { await one(queue.shift()); await new Promise(r => setTimeout(r, 40)) } }))
fs.writeFileSync(`${SP}/bkk_osm.json`, JSON.stringify(out))
console.log('done tiles', done, 'stations', out.stations.length, 'buildings', out.buildings.length, 'roads', out.roads.length)
