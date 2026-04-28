import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/, so we allow overriding base at build time.
  // Locally it stays "/".
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
