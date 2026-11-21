import type { EdgeUse } from './engine'
import type { ZoneId } from './rules/zones'

/**
 * Example plot: the corner of Sukhumvit Road and Sukhumvit Soi 95, beside BTS Bang Chak (Phra Khanong, Bangkok).
 *
 * Every number below is an ESTIMATE, because the BMA parcel tool cannot be reached from the build machine (see docs/area-ranking.md):
 * - zone Y.7: the official 2013 plan map shows orange Y.7-21 here (95 % orange in a 500 m circle). Read by eye, not checked on the parcel tool (A-02).
 * - Soi 95 right-of-way 12 m: lower quartile of the building-to-building gap along the soi in the OSM data (10th percentile 9 m, median 13 m) (A-05).
 * - Sukhumvit Road right-of-way 36 m: gap between the two carriageway lines plus a carriageway each side; the building-to-building gap
 *   has a 10th percentile of 32 m and a lower quartile of 40 m (A-05).
 * - Within 500 m of a station: about 175 to 230 m from the BTS Bang Chak station node (A-10).
 * - The plot itself is hypothetical, an empty 50 m x 40 m rectangle (A-01).
 */

// Local frame at the point where Soi 95 meets the Sukhumvit carriageway line.
const J = { lon: 100.604698, lat: 13.698267 }
const KX = 111320 * Math.cos((J.lat * Math.PI) / 180)
const KY = 110574
const L = Math.hypot(0.92, 0.391)
const U = [0.92 / L, 0.391 / L] // along Soi 95, away from Sukhumvit Road (east, north), unit length
const V = [-U[1], U[0]] // across the soi, to its north side

// Rounded to 7 decimal places (about 1 cm): Terra Draw rejects coordinates with more than 9 decimals.
const r7 = (n: number) => Math.round(n * 1e7) / 1e7
const at = (u: number, v: number): [number, number] => [
  r7(J.lon + (u * U[0] + v * V[0]) / KX),
  r7(J.lat + (u * U[1] + v * V[1]) / KY),
]

// Counter-clockwise. Edge 0: the 50 m frontage on Soi 95. Edge 1: back. Edge 2: neighbour. Edge 3: the 40 m frontage on Sukhumvit Road.
// u = 8 m is the east boundary of Sukhumvit Road (centre line about 10 m west of J, half of 36 m); v = 6 m is the edge of the 12 m soi.
const corners = [at(8, 6), at(58, 6), at(58, 46), at(8, 46)]

export const STATION: [number, number] = [100.6053, 13.6968] // BTS Bang Chak (OSM station node)

export const EXAMPLE: {
  name: string
  plot: [number, number][]
  center: [number, number]
  zone: ZoneId
  roadEdge: number
  roadWidth: number
  extra: Record<number, EdgeUse>
  nearStation: boolean
} = {
  name: 'Corner of Sukhumvit Road and Sukhumvit Soi 95, about 200 m from BTS Bang Chak',
  plot: [...corners, corners[0]],
  center: at(33, 26),
  zone: 'Y.7',
  roadEdge: 0,
  roadWidth: 12,
  extra: { 3: { kind: 'road', width: 36 } },
  nearStation: true,
}
