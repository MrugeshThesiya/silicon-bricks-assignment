const A = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noreferrer">{children}</a>
)

/** Data and credits (OSM attribution is also shown on the map itself and must stay visible). */
export function Credits() {
  return (
    <section className="credits">
      <p className="foot">
        Prototype. Zone sub-area and road width are your inputs and are not checked against official data.
        Map data © <A href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</A>.
      </p>
      <details>
        <summary>Data &amp; credits</summary>
        <h3>Map</h3>
        <ul>
          <li>Map data © <A href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</A>, available under the <A href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database Licence (ODbL)</A>.</li>
          <li>Basemap tiles and style: <A href="https://openfreemap.org">OpenFreeMap</A>, <A href="https://www.openmaptiles.org/">© OpenMapTiles</A>.</li>
        </ul>
        <h3>Rules</h3>
        <ul>
          <li>Bangkok Comprehensive Plan B.E. 2556 (2013), zone types Y.5 to Y.7: <A href="https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf">Ministerial Regulation (Royal Gazette copy)</A>.</li>
          <li>Building Control Act: <A href="https://download.asa.or.th/03media/04law/cba/mr/mr43-55-upd68.pdf">Ministerial Regulation 55</A> (buildings under 23 m) and <A href="https://download.asa.or.th/03media/04law/cba/mr/mr35-33-upd69.pdf">Ministerial Regulation 33</A> (high-rise and large buildings).</li>
          <li>Each check in the list shows its rule ID; the sources and our assumptions are in <code>docs/zoning-rules.md</code> in the repository.</li>
        </ul>
        <h3>Software</h3>
        <ul>
          <li><A href="https://maplibre.org">MapLibre GL JS</A> (BSD-3), <A href="https://terradraw.io">Terra Draw</A> (MIT), <A href="https://github.com/junmer/clipper-lib">clipper-lib</A> (Boost), React, Zustand, Vite.</li>
        </ul>
        <p className="muted small">An indicative tool, not legal or planning advice. Check a real plot with the Bangkok City Planning Department and a licensed architect.</p>
      </details>
    </section>
  )
}
