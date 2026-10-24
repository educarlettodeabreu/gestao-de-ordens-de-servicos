import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const chave = process.env.DEV_HTTPS_KEY
const certificado = process.env.DEV_HTTPS_CERT

if (Boolean(chave) !== Boolean(certificado)) {
  throw new Error('Informe DEV_HTTPS_KEY e DEV_HTTPS_CERT juntos para usar HTTPS local.')
}

const https = chave && certificado
  ? { key: readFileSync(chave), cert: readFileSync(certificado) }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    https,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
        // O Vite termina TLS somente quando os certificados locais estão presentes.
        ...(https ? { headers: { 'X-Forwarded-Proto': 'https' } } : {}),
      },
    },
  },
})
