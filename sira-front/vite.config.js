// vite.config.js
import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import tailwind         from '@tailwindcss/vite'   // <-- IMPORT CORRECTO

export default defineConfig({
  plugins: [
    react(),
    tailwind(),  // <-- USO DEL PLUGIN
  ],
})