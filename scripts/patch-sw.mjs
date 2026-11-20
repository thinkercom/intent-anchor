import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 构建后处理：
// 1) 给 sw.js 注入「新版本激活后刷新旧页面」的钩子；
// 2) 把 404.html 里的 __BASE__ 替换成实际部署路径。
// token 每次构建不同；URL 上的 _swr 标记防止同一版本反复刷新。

const base = process.env.GITHUB_PAGES ? '/intent-anchor/' : '/'
const token = Date.now().toString(36)
const swFile = resolve(process.cwd(), 'dist/sw.js')
const html404 = resolve(process.cwd(), 'dist/404.html')

if (!existsSync(swFile)) {
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

writeFileSync(swFile, readFileSync(swFile, 'utf8') + patch)
console.log(`[patch-sw] injected reload hook ${token}`)

if (existsSync(html404)) {
  const html = readFileSync(html404, 'utf8')
  writeFileSync(html404, html.replaceAll('__BASE__', base))
  console.log(`[patch-sw] 404.html base -> ${base}`)
}
