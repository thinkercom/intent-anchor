import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 新 Service Worker 激活后，主动刷新仍停留在旧版本的页面。
// token 每次构建不同；URL 上的 _swr 标记防止同一版本反复刷新。
const token = Date.now().toString(36)
const file = resolve(process.cwd(), 'dist/sw.js')

if (!existsSync(file)) {
  console.error('[patch-sw] dist/sw.js not found')
  process.exit(1)
}

const patch = `
// 新版本激活后刷新旧页面（构建时注入）
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (var i = 0; i < wins.length; i++) {
      try {
        var u = new URL(wins[i].url)
        if (u.searchParams.get('_swr') === '${token}') continue
        u.searchParams.set('_swr', '${token}')
        wins[i].navigate(u.toString())
      } catch (e) {}
    }
  })())
});
`

writeFileSync(file, readFileSync(file, 'utf8') + patch)
console.log(`[patch-sw] injected reload hook ${token}`)
