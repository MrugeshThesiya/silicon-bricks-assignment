import { create } from 'zustand'
import type { ZoneId } from './rules/zones'

type State = {
  plot: [number, number][] | null
  zone: ZoneId
  roadEdge: number | null
  roadWidth: number
  nearStation: boolean
  showLow: boolean
  showHigh: boolean
  showDesign: boolean
  designId: 'low' | 'tower'
  set: (patch: Partial<Omit<State, 'set'>>) => void
}

export const useApp = create<State>((set) => ({
  plot: null,
  zone: 'Y.7', // A-02, unverified
  roadEdge: null,
  roadWidth: 12, // A-05, right-of-way width
  nearStation: true, // A-10
  showLow: true,
  showHigh: true,
  showDesign: true,
  designId: 'low',
  set: (patch) => set(patch),
}))
