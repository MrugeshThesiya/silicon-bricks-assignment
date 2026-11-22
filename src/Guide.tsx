import { useEffect, useRef } from 'react'

/** A step-by-step guide to using the app. It opens over the map and closes with Esc, the Close button or a click outside it. */
export function Guide({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    box.current?.focus()
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="guide-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" ref={box} tabIndex={-1}>
        <div className="guide-head">
          <h2 id="guide-title">How to use the Bangkok Plot Planner</h2>
          <button onClick={onClose} autoFocus>Close</button>
        </div>
        <p className="muted">
          Tell the app where a plot is and what you want to build. It shows what the rules allow in a Bangkok orange zone
          and gives concept designs with a pass/fail checklist.
        </p>

        <h3>Quick start (1 minute)</h3>
        <ol>
          <li><strong>Press “Example plot”.</strong> A 2,000 m² corner plot at Sukhumvit Road and Soi 95 appears. Its zone, road widths and station distance are estimates, not checked against official data.</li>
          <li><strong>Look at the “Rules that apply” list</strong> in the left panel: plot area, maximum floor area, minimum open space, setbacks and the height rule.</li>
          <li><strong>Look at the map.</strong> The <span className="dot amber" />amber block is the space allowed under 23 m, the <span className="dot blue" />blue block is the space allowed for a high-rise, and the <span className="dot green" />green block is a concept design.</li>
          <li><strong>Switch designs</strong> in “Concept designs” and read each one’s checklist.</li>
          <li><strong>Change something</strong> (the building type, the road width, drag a corner) and watch everything update.</li>
        </ol>

        <h3>Using your own plot</h3>
        <ol>
          <li>Press <strong>Draw plot</strong> and click the corners of the plot on the map. Click the last corner again to finish. Any shape works.</li>
          <li>To edit it, drag a corner, click the small dot between two corners to add a new corner (then drag it), or drag the whole plot. Dragging straight from that small dot moves the whole plot instead. The results update as you drag. <strong>Clear</strong> removes the plot.</li>
          <li>Set <strong>Zone type</strong>. Only the orange zone types in the list are supported.</li>
          <li>Set <strong>Edge that faces the road</strong>. The edges are numbered on the map (the numbers are not shown in the saved-copy fallback map).</li>
          <li>Type the <strong>road width</strong>, boundary to boundary, in metres. A building of 23 m or more needs a road at least 10 m wide, and the height limit comes from the road width.</li>
          <li>If other sides of the plot face a road or a canal, set them under <strong>Other sides</strong>. This changes the setbacks.</li>
          <li>Tick <strong>Within 500 m of an MRT/BTS station</strong> only if that is true for your plot. It changes what the rules allow.</li>
          <li>Pick the <strong>Building type</strong>: condominium, hotel, office, mixed use, or shophouse / townhouse rows.</li>
        </ol>

        <h3>Reading the results</h3>
        <ul>
          <li><strong>Checklist:</strong> ✓ passes, ✗ fails, <em>i</em> is information only. Each line shows the rule ID (for example R-30). The rules and our assumptions are listed in <code>docs/zoning-rules.md</code> in the repository.</li>
          <li><strong>Tabs ✓ or ✗:</strong> a design with ✗ breaks at least one check. The checklist says which.</li>
          <li><strong>“Show on map”</strong> hides or shows each layer, and the existing OSM buildings on the plot. By default the plot is treated as an empty field, so buildings on it count for nothing. Neighbouring buildings and roads always stay.</li>
          <li><strong>“Share of allowed floor area”</strong> tells you how much of the maximum floor area the design uses.</li>
        </ul>

        <h3>Moving around the 3D map</h3>
        <ul>
          <li><strong>Top, Angle, Street, Orbit</strong> (buttons on the map) jump to a view. Orbit turns slowly around the plot. Click it again or touch the map to stop.</li>
          <li><strong>Drag</strong> to pan. <strong>Scroll</strong> or pinch to zoom.</li>
          <li><strong>Right-drag</strong> (or hold Ctrl and drag) to rotate and tilt. On a touch screen, drag with two fingers. You can tilt down to street level (80°).</li>
          <li>The compass button at the top right points the map north again.</li>
        </ul>

        <h3>Things to keep in mind</h3>
        <ul>
          <li>This is a prototype, not a legal determination. The zone sub-area and road width are your inputs and are not checked against official data. Confirm them with Bangkok Metropolitan Administration (BMA) before relying on any number.</li>
          <li>Building heights in the map come from OpenStreetMap, where many heights are missing, so some neighbours look shorter than they are.</li>
          <li>If the live map service cannot be reached, the app shows a saved copy of the buildings around the example plot. Use the example plot then; other places show no buildings.</li>
          <li>Map data © OpenStreetMap contributors. The full credits are under “Data &amp; credits” at the bottom of the panel.</li>
        </ul>
        <div className="guide-foot"><button className="active" onClick={onClose}>Got it</button></div>
      </div>
    </div>
  )
}
