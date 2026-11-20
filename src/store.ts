import { create } from 'zustand'
import type { Polygon } from 'geojson'

type State = {
  plot: Polygon | null
  setPlot: (plot: Polygon | null) => void
}

export const usePlot = create<State>((set) => ({
  plot: null,
  setPlot: (plot) => set({ plot }),
}))
