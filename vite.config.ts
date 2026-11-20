import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 的项目站点路径是 /<repo>/，其余托管（WorkBuddy、EdgeOne、本地）都在根路径。
// 构建时通过 GITHUB_PAGES=true 切换，避免资源 404。
const base = process.env.GITHUB_PAGES ? '/intent-anchor/' : '/'

export default defineConfig({
  base,
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
        // 用相对路径，子路径部署（GitHub Pages）时也能正确解析
        start_url: '.',
        scope: '.',
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
