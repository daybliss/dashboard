import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const wranglerPort = process.env.WRANGLER_PORT || '8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${wranglerPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/agent'),
      },
    },
  },
})
