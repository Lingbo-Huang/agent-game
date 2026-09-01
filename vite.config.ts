import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.REDVERSE_BACKEND_URL || 'http://127.0.0.1:3001'
const localUser = JSON.stringify({
  userId: 'local-redverse-player',
  username: 'Local Player',
  email: 'local@redverse.test',
})
const localIdentityHeader = 'X-User-Info'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        // Local development only. In production, configure a trusted reverse
        // proxy to replace this header after authenticating the request.
        headers: { [localIdentityHeader]: localUser },
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: new URL('index.html', import.meta.url).pathname,
        children: new URL('children.html', import.meta.url).pathname,
      },
    },
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
