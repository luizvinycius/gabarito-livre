import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // HTTPS com certificado próprio: a câmera do celular só funciona em HTTPS.
  plugins: [react(), basicSsl()],
  server: { host: true },
  preview: { host: true },
})
