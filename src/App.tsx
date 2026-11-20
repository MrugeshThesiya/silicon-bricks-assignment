import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import { useApp } from './store'
import { compute, type Check } from './engine'
import { ZONES, type ZoneId } from './rules/zones'
import { empty, floorsToFC, roadEdgeToFC, slicesToFC } from './mapData'

// Basemap: OpenFreeMap (OpenStreetMap data). Its style supplies the
// "© OpenStreetMap contributors" attribution, shown by the control below.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const CENTER: [number, number] = [100.5742, 13.779]

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const ICON: Record<Check['status'], string> = { pass: '✓', fail: '✗', info: 'i' }

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const ready = useRef(false)
  const s = useApp()
  const plot = useDeferredValue(s.plot)

  const result = useMemo(
    () => (plot ? compute({ plot, zone: s.zone, roadEdge: s.roadEdge, roadWidth: s.roadWidth, nearStation: s.nearStation }) : null),
    [plot, s.zone, s.roadEdge, s.roadWidth, s.nearStation],
  )
  const design = result?.designs.find((d) => d.id === s.designId) ?? result?.designs[0] ?? null

  // Map and drawing, created once.
  useEffect(() => {
    const map = new maplibregl.Map({ container: mapEl.current!, style: STYLE, center: CENTER, zoom: 16.5, pitch: 55, attributionControl: false })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = map // handy for debugging
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawSelectMode({
          flags: { polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } } },
        }),
      ],
    })
    drawRef.current = draw

    const sync = () => {
      const f = draw.getSnapshot().find((x) => x.geometry.type === 'Polygon')
      useApp.getState().set({ plot: f ? ((f.geometry as Polygon).coordinates[0] as [number, number][]) : null })
    }

    map.on('load', () => {
      const ext = (id: string, color: string, opacity: number) => {
        map.addSource(id, { type: 'geojson', data: empty })
        map.addLayer({
          id, source: id, type: 'fill-extrusion',
          paint: { 'fill-extrusion-color': color, 'fill-extrusion-opacity': opacity, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['get', 'b'] },
        })
      }
      ext('env-low', '#f59e0b', 0.22)
      ext('env-high', '#2563eb', 0.2)
      ext('design', '#10b981', 0.92)
      map.addSource('road-edge', { type: 'geojson', data: empty })
      map.addLayer({ id: 'road-edge', source: 'road-edge', type: 'line', paint: { 'line-color': '#dc2626', 'line-width': 5 } })
      ready.current = true
      draw.start()
      draw.on('finish', () => {
        sync()
        draw.setMode('select')
      })
      draw.on('change', sync)
      useApp.getState().set({}) // trigger first data push
    })
    return () => {
      ready.current = false
      draw.stop()
      map.remove()
    }
  }, [])

  // Push results to the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    const put = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data)
    put('env-low', result && s.showLow ? slicesToFC(result.slicesLow, result.frame) : empty)
    put('env-high', result && s.showHigh ? slicesToFC(result.slicesHigh, result.frame) : empty)
    put('design', result && design && s.showDesign ? floorsToFC(design.floors, result.frame) : empty)
    put('road-edge', roadEdgeToFC(result))
  }, [result, design, s.showLow, s.showHigh, s.showDesign])

  const startDrawing = () => {
    drawRef.current?.clear()
    useApp.getState().set({ plot: null, roadEdge: null })
    drawRef.current?.setMode('polygon')
  }
  const clear = () => {
    drawRef.current?.clear()
    useApp.getState().set({ plot: null, roadEdge: null })
  }

  const zone = ZONES[s.zone]

  return (
    <div className="layout">
      <aside className="panel">
        <h1>Bangkok Plot Planner</h1>
        <p className="muted">What can you build on a plot in an orange zone, and what could it look like?</p>

        <div className="row">
          <button onClick={startDrawing}>Draw plot</button>
          <button onClick={clear}>Clear</button>
        </div>

        <h2>Site</h2>
        <label>
          Zone type
          <select value={s.zone} onChange={(e) => s.set({ zone: e.target.value as ZoneId })}>
            {Object.values(ZONES).map((z) => (
              <option key={z.id} value={z.id}>{z.label}</option>
            ))}
          </select>
        </label>
        <label>
          Building type
          <select value="condo" disabled>
            <option value="condo">Condominium (residential)</option>
          </select>
        </label>
        <label>
          Edge that faces the road
          <select value={result?.roadEdge ?? ''} disabled={!result} onChange={(e) => s.set({ roadEdge: Number(e.target.value) })}>
            {result?.edges.map((e, i) => (
              <option key={i} value={i}>Edge {i + 1}, {e.length.toFixed(0)} m</option>
            ))}
          </select>
        </label>
        <label>
          Road width, boundary to boundary (m)
          <input type="number" min={2} max={80} step={1} value={s.roadWidth} onChange={(e) => s.set({ roadWidth: Math.max(2, Number(e.target.value) || 2) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.nearStation} onChange={(e) => s.set({ nearStation: e.target.checked })} />
          Within 500 m of an MRT/BTS station
        </label>

        {!result && <p className="hint">Click “Draw plot”, then click the corners on the map. Click the last corner again to finish.</p>}

        {result && (
          <>
            <h2>Rules that apply</h2>
            <dl>
              <dt>Plot area</dt><dd>{fmt(result.plotArea)} m²</dd>
              <dt>Max floor area (FAR {zone.far})</dt><dd>{fmt(result.maxGFA)} m²</dd>
              <dt>Min open space (OSR {(zone.osr * 100).toFixed(1)} %)</dt><dd>{fmt(result.osrMinAtMax)} m²</dd>
              <dt>Road setback (under 23 m)</dt><dd>{result.setbacks.road.toFixed(1)} m</dd>
              <dt>Side setback (under 23 m)</dt><dd>{result.setbacks.side} m</dd>
              <dt>All sides (23 m or more)</dt><dd>{result.setbacks.high} m</dd>
              <dt>Height limit</dt><dd>2 × distance to far side of road</dd>
            </dl>
            {result.notes.map((n) => (
              <p key={n} className="hint">{n}</p>
            ))}
            {result.designs.length > 0 && result.designs.every((d) => d.id !== 'tower') && result.plane.width < 10 && (
              <p className="hint">No tower: a building of 23 m or more needs a road at least 10 m wide (R-30).</p>
            )}

            <h2>Show on map</h2>
            <label className="check"><input type="checkbox" checked={s.showLow} onChange={(e) => s.set({ showLow: e.target.checked })} /><span className="dot amber" />Space allowed under 23 m</label>
            <label className="check"><input type="checkbox" checked={s.showHigh} onChange={(e) => s.set({ showHigh: e.target.checked })} /><span className="dot blue" />Space allowed for a high-rise</label>
            <label className="check"><input type="checkbox" checked={s.showDesign} onChange={(e) => s.set({ showDesign: e.target.checked })} /><span className="dot green" />Concept design</label>

            <h2>Concept designs</h2>
            {result.designs.length === 0 && <p className="hint">The plot is too small for a building that meets the rules.</p>}
            <div className="row tabs">
              {result.designs.map((d) => (
                <button key={d.id} className={d.id === design?.id ? 'active' : ''} onClick={() => s.set({ designId: d.id })}>
                  {d.name} {d.ok ? '✓' : '✗'}
                </button>
              ))}
            </div>
            {design && (
              <>
                <p className="muted">{design.blurb}</p>
                <dl>
                  <dt>Floors</dt><dd>{design.floors.length}</dd>
                  <dt>Height</dt><dd>{design.height.toFixed(1)} m</dd>
                  <dt>Total floor area</dt><dd>{fmt(design.gfa)} m²</dd>
                  <dt>Share of allowed floor area</dt><dd>{((design.gfa / result.maxGFA) * 100).toFixed(0)} %</dd>
                  <dt>Ground covered</dt><dd>{fmt(design.coverage)} m²</dd>
                  <dt>Open space</dt><dd>{fmt(design.openSpace)} m²</dd>
                </dl>
                <ul className="checks">
                  {design.checks.map((c) => (
                    <li key={c.id} className={c.status}>
                      <span className="icon">{ICON[c.status]}</span>
                      <div>
                        <strong>{c.label}</strong> <span className="rule">{c.rule}</span>
                        <div className="detail">{c.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <p className="foot">
          Prototype. Rules from the 2013 Bangkok Comprehensive Plan and Ministerial Regulations 33 and 55; assumptions in docs/zoning-rules.md.
          Zone sub-area and road width are not checked against official data. Map data © OpenStreetMap contributors.
        </p>
      </aside>
      <div id="map" ref={mapEl} />
    </div>
  )
}
