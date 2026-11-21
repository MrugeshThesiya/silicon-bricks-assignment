import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * MapLibre starts its own Web Worker from a file next to its chunk, and works the URL out at run time
 * (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`), so the bundler never sees it and leaves it out of dist/.
 * Without it the production map never loads ("Worker failed to load"). Copy it to where MapLibre looks.
 * The file has no imports of its own.
 */
function maplibreWorker(): Plugin {
  return {
    name: 'maplibre-worker',
    apply: 'build',
    generateBundle() {
      const file = fileURLToPath(new URL('./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url))
      this.emitFile({ type: 'asset', fileName: 'assets/maplibre-gl-worker.mjs', source: readFileSync(file) })
    },
  }
}

export default defineConfig({
  plugins: [react(), maplibreWorker()],
  // MapLibre ships its own web worker; pre-bundling it breaks the worker URL in dev.
  // clipper-lib is only imported inside the engine Web Worker; list it so the dev server bundles it at start-up
  // instead of discovering it late (which leaves the worker with a 504 until a restart).
  optimizeDeps: { exclude: ['maplibre-gl'], include: ['clipper-lib'] },
  build: {
    // Keep MapLibre (the bulk of the bundle) in its own long-cached chunk, apart from the app code.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ }] } } },
    chunkSizeWarningLimit: 1100,
  },
  test: { environment: 'node' },
})
