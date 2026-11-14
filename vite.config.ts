import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' para funcionar em qualquer subpasta (ex.: GitHub Pages /escola-casio-ct-s300/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
