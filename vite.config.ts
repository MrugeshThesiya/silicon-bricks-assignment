import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
