import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  envDir: '..',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  define: {
    // Expose env vars prefixed with VITE_ to the app
  },
}))
