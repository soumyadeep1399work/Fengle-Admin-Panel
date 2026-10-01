import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served at the root of https://admin.fengle.in (its own Apache vhost on the EC2 box).
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { port: 5180 },
  preview: { port: 5180 },
})
