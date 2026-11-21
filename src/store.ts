import { create } from 'zustand'
import type { ZoneId } from './rules/zones'
import type { EdgeUse } from './engine'

type State = {
  plot: [number, number][] | null
  zone: ZoneId
  roadEdge: number | null
  /** Other plot edges that border a road or a canal, by edge index. */
  extra: Record<number, EdgeUse>
  roadWidth: number
  nearStation: boolean
  showLow: boolean
  showHigh: boolean
  showDesign: boolean
  /** Draw the OSM buildings that stand on the plot. Off by default: the plot is treated as an empty field (A-01). */
  showExisting: boolean
  designId: 'low' | 'tower' | 'podium'
  set: (patch: Partial<Omit<State, 'set'>>) => void
}

export const useApp = create<State>((set) => ({
  plot: null,
  zone: 'Y.7', // A-02, unverified
  roadEdge: null,
  extra: {},
  roadWidth: 12, // A-05, right-of-way width
  nearStation: true, // A-10
  showLow: true,
  showHigh: true,
  showDesign: true,
  showExisting: false,
  designId: 'low',
  set: (patch) => set(patch),
}))
