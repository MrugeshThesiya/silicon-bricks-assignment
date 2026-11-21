import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { BAKED_LAYER, BAKED_SOURCE, LOCAL_STYLE, addBakedBuildings } from './baked'

// A very small stand-in for the parts of the map that addBakedBuildings touches.
function fakeMap(layers: string[] = ['env-low']) {
  const sources = new Set<string>()
  const calls: { addSource: unknown[]; addLayer: unknown[][] } = { addSource: [], addLayer: [] }
  const map = {
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    getLayer: (id: string) => (layers.includes(id) ? {} : undefined),
    addSource: (id: string, spec: unknown) => { sources.add(id); calls.addSource.push([id, spec]) },
    addLayer: (...a: unknown[]) => { calls.addLayer.push(a) },
  }
  return { map: map as unknown as MapLibreMap, calls }
}
const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 7, properties: { h: 12, b: 0 }, geometry: { type: 'Polygon', coordinates: [[[100.6, 13.69], [100.601, 13.69], [100.601, 13.691], [100.6, 13.69]]] } }] }
const respond = (ok: boolean, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => { if (typeof body === 'string') throw new SyntaxError('not json'); return body } })))

afterEach(() => vi.unstubAllGlobals())

describe('baked buildings fallback', () => {
  it('adds the baked buildings as a 3D layer under the envelopes, with the OSM credit', async () => {
    respond(true, fc)
    const { map, calls } = fakeMap()
    expect(await addBakedBuildings(map, 'env-low')).toBe(true)
    const [id, spec] = calls.addSource[0] as [string, { attribution: string }]
    expect(id).toBe(BAKED_SOURCE)
    expect(spec.attribution).toContain('OpenStreetMap contributors')
    const [layer, before] = calls.addLayer[0] as [{ id: string; type: string }, string]
    expect(layer).toMatchObject({ id: BAKED_LAYER, type: 'fill-extrusion' })
    expect(before).toBe('env-low')
  })
  it('does nothing twice', async () => {
    respond(true, fc)
    const { map, calls } = fakeMap()
    await addBakedBuildings(map, 'env-low')
    expect(await addBakedBuildings(map, 'env-low')).toBe(true)
    expect(calls.addSource).toHaveLength(1)
  })
  it('returns false, without throwing, when the file is missing, is not JSON, or is not a FeatureCollection', async () => {
    for (const [ok, body] of [[false, {}], [true, '<html>app page</html>'], [true, { type: 'Feature' }]] as const) {
      respond(ok, body)
      const { map, calls } = fakeMap()
      expect(await addBakedBuildings(map, 'env-low')).toBe(false)
      expect(calls.addSource).toHaveLength(0)
    }
  })
  it('the plain style needs no network: only a background', () => {
    expect(LOCAL_STYLE.sources).toEqual({})
    expect(LOCAL_STYLE.layers.map((l) => l.type)).toEqual(['background'])
    expect((LOCAL_STYLE as { glyphs?: string }).glyphs).toBeUndefined()
  })
})
