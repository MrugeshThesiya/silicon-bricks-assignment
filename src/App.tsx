import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import { usePlot } from './store'
import { insetPlot, plotArea } from './geometry'

// Basemap: OpenFreeMap (OpenStreetMap data). Its style supplies the
// "© OpenStreetMap contributors" attribution, shown by the control below.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const BANGKOK: [number, number] = [100.5742, 13.779]

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const { plot, setPlot } = usePlot()

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current!,
      style: STYLE,
      center: BANGKOK,
      zoom: 16,
      pitch: 55,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                coordinates: { midpoints: true, draggable: true, deletable: true },
              },
            },
          },
        }),
      ],
    })
    drawRef.current = draw

    const sync = () => {
      const f = draw.getSnapshot().find((x) => x.geometry.type === 'Polygon')
      setPlot(f ? (f.geometry as Polygon) : null)
    }
    map.on('load', () => {
      draw.start()
      draw.on('finish', () => { sync(); draw.setMode('select') })
      draw.on('change', sync)
    })
    return () => { draw.stop(); map.remove() }
  }, [setPlot])

  const clear = () => { drawRef.current?.clear(); setPlot(null) }
  const inset = plot ? insetPlot(plot, 5) : null

  return (
    <div className="layout">
      <aside className="panel">
        <h1>Bangkok Plot Planner</h1>
        <button onClick={() => { drawRef.current?.clear(); drawRef.current?.setMode('polygon') }}>Draw plot</button>
        <button onClick={clear}>Clear</button>
        <dl>
          <dt>Plot area</dt><dd>{plot ? `${plotArea(plot).toFixed(0)} m²` : '–'}</dd>
          <dt>Area after 5 m inset</dt><dd>{inset ? `${plotArea(inset).toFixed(0)} m²` : '–'}</dd>
        </dl>
        <p style={{ fontSize: 12, color: '#666' }}>
          Basic scaffold. Map data © OpenStreetMap contributors.
        </p>
      </aside>
      <div id="map" ref={mapEl} />
    </div>
  )
}
