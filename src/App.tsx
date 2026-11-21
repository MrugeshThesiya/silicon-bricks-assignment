import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import { useApp } from './store'
import type { Check, Input } from './engine'
import { useCompute } from './useCompute'
import { Credits } from './Credits'
import { EdgeUses } from './EdgeUses'
import { EXAMPLE } from './example'
import { buildingIdsOnPlot, loadedBuildings, setHiddenBuildings } from './existingBuildings'
import { ZONES, type ZoneId } from './rules/zones'
import { edgesToFC, empty, floorsToFC, slicesToFC } from './mapData'

// Basemap: OpenFreeMap (OpenStreetMap data). Its style supplies the
// "© OpenStreetMap contributors" attribution, shown by the control below.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
// Demo area: Sukhumvit Road at BTS Bang Chak (Phra Khanong). Official 2013 plan map: orange Y.7-21; 95 % orange in a 500 m circle.
// Chosen by the measured comparison in docs/area-ranking.md. The values of the example plot are estimates (src/example.ts).
const CENTER: [number, number] = EXAMPLE.center

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const ICON: Record<Check['status'], string> = { pass: '✓', fail: '✗', info: 'i' }

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const ready = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const s = useApp()
  // The road width box keeps its own text while you type, so you can clear it and retype; it commits once the value is valid.
  const [roadText, setRoadText] = useState(String(s.roadWidth))
  const input = useMemo<Input | null>(
    () => (s.plot ? { plot: s.plot, zone: s.zone, roadEdge: s.roadEdge, roadWidth: s.roadWidth, nearStation: s.nearStation, extra: s.extra } : null),
    [s.plot, s.zone, s.roadEdge, s.roadWidth, s.nearStation, s.extra],
  )
  // The engine runs in a Web Worker, so drawing and dragging never wait for it.
  const { result, busy, error } = useCompute(input)
  const design = result?.designs.find((d) => d.id === s.designId) ?? result?.designs[0] ?? null

  // Map and drawing, created once.
  useEffect(() => {
    const map = new maplibregl.Map({ container: mapEl.current!, style: STYLE, center: CENTER, zoom: 17, pitch: 55, attributionControl: false })
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
      map.addSource('edges', { type: 'geojson', data: empty })
      map.addLayer({
        id: 'edges', source: 'edges', type: 'line',
        paint: {
          'line-color': ['match', ['get', 'kind'], 'canal', '#0284c7', '#dc2626'],
          'line-width': ['case', ['get', 'main'], 6, 3],
          'line-opacity': ['match', ['get', 'kind'], 'plot', 0, 1],
        },
      })
      map.addLayer({
        id: 'edge-labels', source: 'edges', type: 'symbol',
        layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true, 'text-offset': [0, -1] },
        paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 2 },
      })
      ready.current = true
      draw.start()
      draw.on('finish', (id, context) => {
        sync()
        // Only when a new polygon was just completed: switch to editing and keep it selected so its corners can be dragged.
        // (A drag also ends with 'finish'; switching mode then would deselect the plot after every move.)
        if (context.mode === 'polygon') {
          draw.setMode('select')
          draw.selectFeature(id)
          setDrawing(false)
        }
      })
      // While a new polygon is being drawn, every mouse move fires 'change'. Wait for 'finish'; Terra Draw shows the outline itself.
      draw.on('change', () => {
        if (draw.getMode() === 'select') sync()
      })
      setMapReady(true)
    })
    return () => {
      ready.current = false
      try {
        draw.stop()
      } catch {
        /* never started: the map had not finished loading */
      }
      map.remove()
    }
  }, [])

  // Push results to the map, one source at a time so a toggle only touches its own layer.
  const put = (id: string, data: GeoJSON.FeatureCollection) => {
    const map = mapRef.current
    if (map && ready.current) (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data)
  }
  useEffect(() => put('env-low', result && s.showLow ? slicesToFC(result.slicesLow, result.frame) : empty), [result, s.showLow])
  useEffect(() => put('env-high', result && s.showHigh ? slicesToFC(result.slicesHigh, result.frame) : empty), [result, s.showHigh])
  useEffect(() => put('design', result && design && s.showDesign ? floorsToFC(design.floors, result.frame) : empty), [result, design, s.showDesign])
  useEffect(() => put('edges', edgesToFC(result)), [result])

  // Hide the OSM buildings that stand on the plot (they are treated as demolished). Re-checked whenever the map goes idle,
  // because more tiles may have loaded since.
  const hidden = useRef('')
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let timer: number | undefined
    const run = () => {
      if (!ready.current) return
      const ids = s.plot && !s.showExisting ? buildingIdsOnPlot(loadedBuildings(map), s.plot) : []
      const key = ids.map(String).sort().join(',')
      if (key === hidden.current) return
      hidden.current = key
      setHiddenBuildings(map, ids)
    }
    const later = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 150)
    }
    later()
    map.on('idle', later)
    return () => {
      window.clearTimeout(timer)
      map.off('idle', later)
    }
  }, [s.plot, s.showExisting])

  const startDrawing = () => {
    if (!ready.current) return
    drawRef.current?.clear()
    useApp.getState().set({ plot: null, roadEdge: null, extra: {} })
    drawRef.current?.setMode('polygon')
    setDrawing(true)
  }
  const loadExample = () => {
    const draw = drawRef.current, map = mapRef.current
    if (!draw || !map || !ready.current) return
    draw.clear()
    const res = draw.addFeatures([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [EXAMPLE.plot] }, properties: { mode: 'polygon' } }])
    if (!res[0]?.valid) console.warn('Example plot rejected by Terra Draw:', res[0])
    draw.setMode('select')
    if (res[0]?.id !== undefined) draw.selectFeature(res[0].id)
    useApp.getState().set({
      plot: EXAMPLE.plot, zone: EXAMPLE.zone, roadEdge: EXAMPLE.roadEdge, roadWidth: EXAMPLE.roadWidth,
      extra: EXAMPLE.extra, nearStation: EXAMPLE.nearStation,
    })
    setRoadText(String(EXAMPLE.roadWidth))
    setDrawing(false)
    map.easeTo({ center: EXAMPLE.center, zoom: 17.2, pitch: 55, duration: 800 })
  }
  const clear = () => {
    if (!ready.current) return
    drawRef.current?.clear()
    drawRef.current?.setMode('select')
    useApp.getState().set({ plot: null, roadEdge: null, extra: {} })
    setDrawing(false)
  }

  const zone = ZONES[s.zone]

  return (
    <div className="layout">
      <aside className="panel">
        <h1>Bangkok Plot Planner</h1>
        <p className="muted">What can you build on a plot in an orange zone, and what could it look like?</p>

        <div className="row">
          <button className={drawing ? 'active' : ''} onClick={startDrawing} disabled={!mapReady}>Draw plot</button>
          <button onClick={clear} disabled={!mapReady || (!s.plot && !drawing)}>Clear</button>
          <button onClick={loadExample} disabled={!mapReady} title={EXAMPLE.name}>Example plot</button>
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
          <input
            type="number" min={2} max={80} step={1} value={roadText}
            onChange={(e) => {
              setRoadText(e.target.value)
              const w = Number(e.target.value)
              if (e.target.value !== '' && Number.isFinite(w) && w >= 2 && w <= 80) s.set({ roadWidth: w })
            }}
            onBlur={() => setRoadText(String(s.roadWidth))}
          />
        </label>
        {result && result.edges.length > 1 && (
          <EdgeUses edges={result.edges} roadEdge={result.roadEdge} extra={s.extra} onChange={(extra) => s.set({ extra })} />
        )}
        <label className="check">
          <input type="checkbox" checked={s.nearStation} onChange={(e) => s.set({ nearStation: e.target.checked })} />
          Within 500 m of an MRT/BTS station
        </label>

        {error && <p className="hint warn">{error}</p>}
        {busy && <p className="hint">Working it out…</p>}
        {!mapReady && <p className="hint">Loading the map…</p>}
        {mapReady && drawing && <p className="hint">Click the corners of the plot on the map. Click the last corner again to finish.</p>}
        {mapReady && !drawing && !result && !error && !busy && <p className="hint">Click “Draw plot”, then click the corners on the map. After that you can drag a corner or the whole plot to change it.</p>}
        {result && !drawing && s.plot === EXAMPLE.plot && (
          <p className="hint">Example: {EXAMPLE.name}. Zone, road widths and station distance are estimates (see Data &amp; credits).</p>
        )}
        {result && !drawing && <p className="muted small">Drag a corner or the whole plot to reshape it. Everything updates as you drag.</p>}

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
            <label className="check"><input type="checkbox" checked={s.showExisting} onChange={(e) => s.set({ showExisting: e.target.checked })} />Existing buildings on the plot</label>
            <p className="muted small">Off by default: the plot is treated as an empty field, so buildings on it count for nothing. Neighbours always stay.</p>

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

        <Credits />
      </aside>
      <div id="map" ref={mapEl} />
    </div>
  )
}
