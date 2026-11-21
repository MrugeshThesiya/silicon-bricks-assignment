import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // MapLibre ships its own web worker; pre-bundling it breaks the worker URL in dev.
  // clipper-lib is only imported inside the engine Web Worker; list it so the dev server bundles it at start-up
  // instead of discovering it late (which leaves the worker with a 504 until a restart).
  optimizeDeps: { exclude: ['maplibre-gl'], include: ['clipper-lib'] },
  test: { environment: 'node' },
})
