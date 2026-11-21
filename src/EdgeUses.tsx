import { useState } from 'react'
import type { Edge, EdgeUse } from './engine'

type Kind = 'plot' | 'road' | 'canal'
const DEFAULT_WIDTH: Record<'road' | 'canal', number> = { road: 8, canal: 6 }

function WidthBox({ value, onValue }: { value: number; onValue: (w: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <input
      type="number" min={1} max={80} step={1} value={text} aria-label="Width in metres"
      onChange={(e) => {
        setText(e.target.value)
        const w = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(w) && w >= 1 && w <= 80) onValue(w)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

/**
 * What each plot edge, other than the one facing the road, borders: a neighbour (the default), another road, or a canal.
 * The numbers match the labels drawn on the map. Rules: R-11 to R-15, R-22 (assumptions A-13, A-14).
 */
export function EdgeUses({ edges, roadEdge, extra, onChange }: {
  edges: Edge[]
  roadEdge: number
  extra: Record<number, EdgeUse>
  onChange: (extra: Record<number, EdgeUse>) => void
}) {
  const set = (i: number, kind: Kind, width?: number) => {
    const next = { ...extra }
    if (kind === 'plot') delete next[i]
    else next[i] = { kind, width: width ?? extra[i]?.width ?? DEFAULT_WIDTH[kind] }
    onChange(next)
  }
  return (
    <details className="edges" open={Object.keys(extra).length > 0}>
      <summary>Other sides: another road or a canal?</summary>
      <p className="muted small">Edge numbers are shown on the map. A corner plot or a plot beside a canal changes the setbacks.</p>
      {edges.map((e, i) =>
        i === roadEdge ? null : (
          <div className="edge-row" key={i}>
            <span>Edge {i + 1}, {e.length.toFixed(0)} m</span>
            <select value={extra[i]?.kind ?? 'plot'} onChange={(ev) => set(i, ev.target.value as Kind)}>
              <option value="plot">Neighbour</option>
              <option value="road">Road</option>
              <option value="canal">Canal</option>
            </select>
            {extra[i] ? (
              <span className="w"><WidthBox key={`${i}-${extra[i].kind}`} value={extra[i].width} onValue={(w) => set(i, extra[i].kind, w)} /> m</span>
            ) : <span />}
          </div>
        ),
      )}
    </details>
  )
}
