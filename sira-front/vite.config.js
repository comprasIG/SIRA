// C:\SIRA\SIRA\sira-front\vite.config.js
import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import tailwind         from '@tailwindcss/vite'   // <-- IMPORT CORRECTO
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwind(),  // <-- USO DEL PLUGIN
  ],
   resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})