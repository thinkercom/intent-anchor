/**
 * 生成「花填字」用的花簇纹理（SVG → data URI）。
 *
 * 关键教训：花填字填充的是**文字的笔画**，笔画本身很细。
 * 如果花簇之间有深色缝，笔画就会落进缝里，整句话看起来只是
 * 「一块深色底 + 零星粉点」。所以这块纹理必须接近满铺：
 * 花与花互相压住，底色几乎不露。
 *
 * 做法：抖动网格铺花（4×4，半径大于间距的一半，保证重叠），
 * 靠边的花在对面再画一遍，平铺时没有接缝。
 *
 * 用法：node scripts/gen-flower-fill.mjs [--preview]
 */

const TILE = 200
const GRID = 4
const SPACING = TILE / GRID // 50

/** 固定种子，保证每次生成结果一致（否则每次构建 CSS 内容都会变） */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 一簇花：6 片椭圆花瓣绕轴排列 + 花心 */
const rosette = (cx, cy, r, petal, core, rot) => {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = rot + i * 60
    return `<ellipse cx="${cx.toFixed(1)}" cy="${(cy - r * 0.5).toFixed(1)}" rx="${(r * 0.4).toFixed(1)}" ry="${(r * 0.62).toFixed(1)}" fill="${petal}" transform="rotate(${a.toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`
  }).join('')
  return `${petals}<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.2).toFixed(1)}" fill="${core}"/>`
}

const build = ({ base, palette, core, leaf, seed }) => {
  const rnd = mulberry32(seed)
  const parts = [`<rect width="${TILE}" height="${TILE}" fill="${base}"/>`]

  // 叶子垫在最下层：只用来填花与花之间的死角，不抢主体
  const leaves = []
  for (let i = 0; i < 14; i++) {
    const x = rnd() * TILE
    const y = rnd() * TILE
    leaves.push(
      `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(6 + rnd() * 4).toFixed(1)}" ry="${(11 + rnd() * 7).toFixed(1)}" fill="${leaf}" transform="rotate(${(rnd() * 360).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
    )
  }
  parts.push(leaves.join(''))

  const flowers = []
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const cx = gx * SPACING + SPACING / 2 + (rnd() - 0.5) * 16
      const cy = gy * SPACING + SPACING / 2 + (rnd() - 0.5) * 16
      // 半径必须大于间距的一半（25），否则花与花之间会露出底色缝
      const r = 26 + rnd() * 9
      const petal = palette[Math.floor(rnd() * palette.length)]
      const rot = rnd() * 60
      // 靠边的花在对面重复一份，消除平铺接缝
      const dx = cx < r * 1.2 ? TILE : cx > TILE - r * 1.2 ? -TILE : 0
      const dy = cy < r * 1.2 ? TILE : cy > TILE - r * 1.2 ? -TILE : 0
      flowers.push(rosette(cx, cy, r, petal, core, rot))
      if (dx) flowers.push(rosette(cx + dx, cy, r, petal, core, rot))
      if (dy) flowers.push(rosette(cx, cy + dy, r, petal, core, rot))
      if (dx && dy) flowers.push(rosette(cx + dx, cy + dy, r, petal, core, rot))
    }
  }
  parts.push(flowers.join(''))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">${parts.join('')}</svg>`
}

// 浅色主题：花偏饱和的玫红/杏/珊瑚，底色压暗一点保证字的可读性
const light = build({
  base: '#26332a',
  leaf: '#5f7d52',
  core: '#f6e0b0',
  seed: 20261123,
  palette: ['#a8324f', '#c96a45', '#a8324f', '#7d3552', '#c96a45'],
})

// 深色主题：底改用深紫灰，花提亮到有发光感，避免整块糊成暗调
const dark = build({
  base: '#2a1f36',
  leaf: '#5d7a66',
  core: '#f2dcae',
  seed: 77123,
  palette: ['#c9527a', '#d9864c', '#c9527a', '#9a3f6f', '#d9864c'],
})

// 只转义必须转义的四个字符，比 encodeURIComponent 少一半体积
const toUri = (svg) =>
  `url("data:image/svg+xml,${svg
    .replace(/#/g, '%23')
    .replace(/"/g, "'")
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')}")`

// 写成独立 SVG 资源：CSS 只留一行 url()，Vite 会带 hash 和正确的 base 输出
const fsSync = await import('node:fs')
fsSync.writeFileSync('src/styles/flower-light.svg', light)
fsSync.writeFileSync('src/styles/flower-dark.svg', dark)
console.error('wrote src/styles/flower-light.svg / flower-dark.svg')

// 附带一个本地预览页，方便肉眼确认花簇密度（不参与构建）
if (process.argv.includes('--preview')) {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4f2ec;font-family:system-ui">
  <style>
    .tile { width: 340px; height: 200px; background-size: 200px 200px; }
    .light { background-image: ${toUri(light)}; }
    .dark { background-image: ${toUri(dark)}; }
    .type { font-family: Georgia, serif; font-size: 64px; line-height: 1; font-weight: 400;
      background-clip: text; -webkit-background-clip: text; color: transparent;
      -webkit-text-fill-color: transparent; background-size: 110px 110px; display: inline-block; }
    p { color: #2c2a26; margin: 0 0 8px; font-size: 12px; }
    .darkbg { background: #07080c; padding: 12px; display: inline-block; }
  </style>
  <div style="padding:24px">
    <p>整块纹理（浅）</p><div class="tile light"></div>
    <p style="margin-top:20px">整块纹理（深）</p><div class="tile dark"></div>
    <p style="margin-top:20px">实际字号下的填充（浅）</p>
    <div class="type light">Attention</div>
    <p style="margin-top:20px">实际字号下的填充（深）</p>
    <div class="darkbg"><div class="type dark">Attention</div></div>
  </div></body>`
  const out = process.env.TEMP ? `${process.env.TEMP}/flower-preview.html` : '/tmp/flower-preview.html'
  const fs = await import('node:fs')
  fs.writeFileSync(out, html)
  console.error('preview ->', out)
}
