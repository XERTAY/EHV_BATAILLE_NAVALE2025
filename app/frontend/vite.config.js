import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const localBackendEnabled = env.VITE_LOCAL_BACKEND !== 'false'
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:4784'

  return {
    plugins: [react()],
    server: {
      port: 2462,
      strictPort: true,
      proxy: localBackendEnabled
        ? {
            '/api': {
              target: backendOrigin,
              changeOrigin: true,
            },
            '/ws': {
              target: backendOrigin,
              ws: true,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      dedupe: ['three'],
    },
  }
})
