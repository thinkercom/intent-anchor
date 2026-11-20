import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'bg-dark.png', 'bg-light.png'],
      manifest: {
        name: 'Intent Anchor',
        short_name: 'Anchor',
        description: '一个打开就能看见自己意图的封面页',
        theme_color: '#07080c',
        background_color: '#07080c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 视频体积较大，采用运行时缓存，首次联网后即可离线播放
        runtimeCaching: [
          {
            urlPattern: /\.(mp4|webm)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bg-videos',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
