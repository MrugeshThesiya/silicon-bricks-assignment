import { HIGH_RISE_HEIGHT, LARGE_BUILDING_AREA } from './zones'

export type Regime = 'low' | 'high'

/** Which rule set applies: C (MR 33) for high-rise or special large buildings, else B (MR 55). */
export function regimeFor(height: number, totalFloorArea: number, largestFloor: number): Regime {
  return height >= HIGH_RISE_HEIGHT || totalFloorArea >= LARGE_BUILDING_AREA || largestFloor >= LARGE_BUILDING_AREA
    ? 'high'
    : 'low'
}

/**
 * Road-side setback from the plot boundary for a building over 2 storeys, under 23 m.
 * R-11..R-14 (MR 55 art. 41). `roadWidth` is the right-of-way width (A-05).
 * Centre-line rules are converted to boundary distances assuming the plot boundary is the road boundary.
 */
export function roadSetbackLow(roadWidth: number): number {
  if (roadWidth < 10) return Math.max(0, 6 - roadWidth / 2) // R-12
  if (roadWidth <= 20) return roadWidth / 10 // R-13
  return 2 // R-14
}

/** Side/rear setback for buildings 9 to 23 m, assuming walls with openings (R-16, A-06). */
export const SIDE_SETBACK_LOW = 3

/** High-rise or special large: 6 m from neighbours and from public roads (R-34). */
export const SETBACK_HIGH = 6

/** Open space required by the building law (not the zoning OSR). R-10 and R-36. */
export function lawMinOpenSpace(regime: Regime, plotArea: number, largestFloor: number): number {
  return regime === 'high' ? 0.3 * plotArea : 0.3 * largestFloor
}

/** Minimum frontage road right-of-way for a high-rise (R-30, R-31). */
export function minRoadWidthHigh(totalFloorArea: number): number {
  return totalFloorArea > 30000 ? 18 : 10
}
