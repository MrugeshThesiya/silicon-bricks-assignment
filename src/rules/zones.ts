// Rule IDs (R-xx) and assumption IDs (A-xx) refer to docs/zoning-rules.md.

export type ZoneId = 'Y.5' | 'Y.6' | 'Y.7'

export type Zone = {
  id: ZoneId
  far: number // max floor area ratio, R-01..R-03
  osr: number // min open space / total floor area, R-01..R-03
  label: string
}

export const ZONES: Record<ZoneId, Zone> = {
  'Y.5': { id: 'Y.5', far: 4, osr: 0.075, label: 'Y.5 orange, FAR 4, OSR 7.5 %' },
  'Y.6': { id: 'Y.6', far: 4.5, osr: 0.065, label: 'Y.6 orange, FAR 4.5, OSR 6.5 %' },
  'Y.7': { id: 'Y.7', far: 5, osr: 0.06, label: 'Y.7 orange, FAR 5, OSR 6 %' },
}

/** A-03 */
export const FLOOR_HEIGHT = 3.2
/** C art. 1: 23.00 m or more is high-rise. */
export const HIGH_RISE_HEIGHT = 23
/** C art. 1: a floor or total of 10,000 m2 or more is a special large building. */
export const LARGE_BUILDING_AREA = 10000
/** Tallest storey count that stays under 23 m at FLOOR_HEIGHT. */
export const MAX_LOW_FLOORS = Math.floor((HIGH_RISE_HEIGHT - 0.01) / FLOOR_HEIGHT)
