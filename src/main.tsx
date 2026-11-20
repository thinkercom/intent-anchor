import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './styles/index.css'

/**
 * PWA 更新兜底：托管环境里用户常常长时间开着页面，
 * 旧 Service Worker 会继续吐出旧 index.html/JS，表现为「修复没上线」。
 * 这里在每次加载时主动检查更新，并在新 SW 接管后自动刷新一次。
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {})
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // SW 已通过 _swr 标记主动导航过，不再重复刷新
    if (new URLSearchParams(location.search).has('_swr')) return
    const key = 'anchor-sw-reload-at'
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
