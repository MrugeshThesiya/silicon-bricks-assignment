import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // MapLibre ships its own web worker; pre-bundling it breaks the worker URL in dev.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  test: { environment: 'node' },
})
