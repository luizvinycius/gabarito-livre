import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // No GitHub Pages o app fica em /<repositório>/ (o workflow passa BASE).
  base: process.env.BASE ?? '/',
  plugins: [
    react(),
    // HTTPS com certificado próprio: a câmera do celular só funciona em HTTPS.
    basicSsl(),
    // App instalável e offline (seção 4). O worker leva o OpenCV junto
    // (cerca de 15 MB) e também fica em cache: depois da primeira visita, o
    // app abre sem internet.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gabarito Livre',
        short_name: 'Gabarito',
        description: 'Corrige a parte objetiva da prova pela câmera do celular.',
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f4f5',
        theme_color: '#1565c0',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
  server: { host: true },
  preview: { host: true },
})
