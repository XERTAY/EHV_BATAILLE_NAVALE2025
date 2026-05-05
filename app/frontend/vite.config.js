import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
      dedupe: ['three'],
    },
  }
})
