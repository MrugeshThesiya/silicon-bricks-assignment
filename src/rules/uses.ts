import type { ZoneId } from './zones'

/**
 * Building types and the use limits of the Bangkok plan for orange zones.
 * Sources and translations: docs/zoning-rules.md section 4b (rule IDs R-40, R-50 to R-56, assumptions A-16 to A-21).
 * Source A = ministerial regulation of the 2013 plan, articles 12 (Y.5), 13 (Y.6), 14 (Y.7), 36, 37; B = MR 55.
 */
export type UseId = 'condo' | 'hotel' | 'office' | 'mixed' | 'rows'

export type UseInfo = {
  label: string
  /** Floor-to-floor height in metres (A-19). */
  floorH: number
  /** Used as housing for the open-space rule: 30 % instead of 10 % (R-56, R-36). */
  housing: boolean
  /** What the user is told about this type. */
  blurb: string
}

export const USES: Record<UseId, UseInfo> = {
  condo: { label: 'Condominium (residential)', floorH: 3.2, housing: true, blurb: 'Multi-unit housing for sale.' },
  hotel: { label: 'Hotel', floorH: 3.2, housing: false, blurb: 'Rooms for guests; the plan limits hotels by room count.' },
  office: { label: 'Office building', floorH: 3.8, housing: false, blurb: 'Offices; the plan limits office floor area in orange zones.' },
  mixed: { label: 'Mixed use (shops below, condominium above)', floorH: 3.2, housing: true, blurb: 'Shops on the lowest floors, housing above.' },
  rows: { label: 'Shophouse / townhouse rows', floorH: 3.2, housing: true, blurb: 'Rows of narrow units: shops on the ground floor, homes above.' },
}

/** Gross floor area of one hotel room (A-16). */
export const ROOM_AREA = 40

/** What the site offers for the plan's "road" and "station" tests. */
export type Access = {
  /** Within 500 m of a mass-transit station (R-54; measured to the platform boundary, art. 37). */
  station: boolean
  /** A plot side of at least `x` m on a road at least `x` m wide (R-54, A-18). */
  road: (x: 12 | 16 | 30) => boolean
}

const ANY = Number.POSITIVE_INFINITY

/** Most hotel rooms allowed (R-50). */
export function hotelMaxRooms(zone: ZoneId, a: Access): number {
  if (zone === 'Y.7') return a.station || a.road(16) ? ANY : 50
  return a.station || a.road(30) ? ANY : a.road(16) ? 80 : 50 // Y.5, Y.6
}

/** Most office floor area allowed, in m² (R-53). Beyond the cap the plan prohibits the use. */
export function officeMaxArea(zone: ZoneId, a: Access): number {
  if (zone === 'Y.5') return a.station || a.road(12) ? 1000 : 300
  if (zone === 'Y.6') return a.station || a.road(30) ? 5000 : a.road(16) ? 2000 : 1000
  return a.station || a.road(16) ? 10000 : 1000 // Y.7
}

/** Most shop (commerce) floor area allowed, in m² (R-52). */
export function commerceMaxArea(zone: ZoneId, a: Access): number {
  if (zone === 'Y.5') return a.station || a.road(30) ? 10000 : a.road(16) ? 5000 : 2000
  if (zone === 'Y.6') return a.station || a.road(30) ? 10000 : 5000
  return a.station || a.road(30) ? ANY : a.road(16) ? 10000 : 5000 // Y.7
}

/** Most multi-unit housing floor area allowed, in m² (R-40). The plan prohibits "over 10,000", the building law switches at 10,000, so stay under. */
export function housingMaxArea(a: Access): number {
  return a.station || a.road(30) ? ANY : 9999
}

/** Floors that hold shops in a mixed-use design (A-20). */
export const SHOP_FLOORS = { low: 2, podium: 3 } as const

/** Layout of shophouse rows (R-55, A-21). */
export const ROWS = {
  unitWidth: 5, // m, at least 4 (R-55a)
  minUnitWidth: 4,
  depth: 16, // m; up to 16 m needs no inner court (R-55a); the limit is 24 m
  maxDepth: 24,
  minUnitArea: 30, // m² of ground floor per shophouse unit (R-55a)
  maxUnitsPerRow: 10, // R-55b
  maxRowLength: 40, // m, first column to last (R-55b)
  gap: 4, // m between rows (R-55c)
  rear: 3, // m open space behind the rows (R-55c)
  floors: 4,
} as const
