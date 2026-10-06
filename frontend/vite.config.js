import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Maersk PO Management',
        short_name: 'MaerskPO',
        description: 'Application de gestion des bons de commande Maersk',
        theme_color: '#00243d',
        background_color: '#f1f5f9',
        display: 'standalone',
        icons: [
          {
            src: '/logo_maersk.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
