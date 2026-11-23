import { useEffect, useRef } from 'react'
import type { Theme } from '../../lib/useTheme'

interface Props {
  theme: Theme
  onToggle: () => void
}

/**
 * 像素溶解版的明暗开关。
 *
 * 做法：把太阳/月亮拆成 2px 的方格粒子，切换时旧图标向外散开并淡出、
 * 新图标从散的粒子中聚拢成形 —— 参考 recent.design 那个「像素粒子
 * 溶散重组」的 3D 开关，但这里没有任何 3D 和 WebGL：
 * 全部是 2D canvas 上的 fillRect，粒子总数不到 200。
 *
 * 性能约束（这是它敢放在首屏的原因）：
 * - 只有切换时跑 rAF，settle 之后立刻停，静止时零开销；
 * - 每颗粒子只算一次缓动，不读布局、不碰 DOM；
 * - canvas 按 devicePixelRatio 放大一次，绘制坐标始终用 CSS px。
 */
const SIZE = 40 // CSS 尺寸
const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3)
const STEP = 2 // 粒子边长（CSS px）
const C = SIZE / 2

type Icon = 'sun' | 'moon'

type Particle = {
  sx: number
  sy: number
  tx: number
  ty: number
  /** 每颗粒子各自的起飞延迟，形成「一片一片化开」的错落感 */
  delay: number
  dur: number
  color: string
  /** out = 旧图标散开，in = 新图标聚拢 */
  kind: 'in' | 'out'
}

/** 太阳：实心圆 + 8 根短射线 */
function isSun(x: number, y: number) {
  const dx = x - C
  const dy = y - C
  const d = Math.hypot(dx, dy)
  if (d <= 6.4) return true
  if (d >= 9.4 && d <= 14.2) {
    const step = Math.PI / 4
    const a = Math.atan2(dy, dx)
    const k = ((a % step) + step) % step
    // 射线不能太粗，否则八根会连成一个环；0.15 大约 2 个像素格宽
    return Math.min(k, step - k) < 0.15
  }
  return false
}

/** 月亮：大圆挖掉一个偏左上方的圆，留下弯月 */
function isMoon(x: number, y: number) {
  // 挖掉的那一块要偏左上，弯月才朝左上开口（和系统图标的朝向一致）
  const inBody = Math.hypot(x - (C + 1.0), y - (C + 1.0)) <= 9.6
  const inBite = Math.hypot(x - (C - 3.6), y - (C - 3.4)) <= 8.0
  return inBody && !inBite
}

const hit = (icon: Icon, x: number, y: number) => (icon === 'sun' ? isSun(x, y) : isMoon(x, y))

/** 图标语义与按钮行为一致：深色时显示太阳（点了变亮） */
const iconOf = (theme: Theme): Icon => (theme === 'dark' ? 'sun' : 'moon')

const colorOf = (icon: Icon, r: number) =>
  icon === 'sun'
    ? `hsl(${36 + r * 14} ${70 + r * 14}% ${60 + r * 12}%)`
    : `hsl(${262 + r * 18} ${26 + r * 16}% ${74 + r * 12}%)`

/** 枚举某个图标覆盖的所有格子中心点 */
function cells(icon: Icon) {
  const out: { x: number; y: number }[] = []
  for (let x = STEP / 2; x < SIZE; x += STEP) {
    for (let y = STEP / 2; y < SIZE; y += STEP) {
      if (hit(icon, x, y)) out.push({ x, y })
    }
  }
  return out
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function PixelThemeToggle({ theme, onToggle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const prevTheme = useRef<Theme | null>(null)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = SIZE * DPR
    canvas.height = SIZE * DPR
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    /** 直接把图标画成静止状态（首帧、动画结束、或无动画时都用它） */
    const drawSettled = (icon: Icon) => {
      ctx.clearRect(0, 0, SIZE, SIZE)
      for (const { x, y } of cells(icon)) {
        ctx.fillStyle = colorOf(icon, Math.abs(Math.sin(x * 12.9898 + y * 78.233)) % 1)
        ctx.fillRect(x - STEP / 2, y - STEP / 2, STEP, STEP)
      }
    }

    const from = prevTheme.current
    prevTheme.current = theme
    const to = iconOf(theme)

    if (!from || reduced.current) {
      drawSettled(to)
      return
    }

    const fromIcon = iconOf(from)
    if (fromIcon === to) {
      drawSettled(to)
      return
    }

    // ---- 组装粒子：旧图标散开 + 新图标聚拢 ----
    const now = performance.now()
    const particles: Particle[] = []

    for (const { x, y } of cells(fromIcon)) {
      const a = Math.atan2(y - C, x - C) + (Math.random() - 0.5) * 0.9
      const dist = 12 + Math.random() * 14
      particles.push({
        sx: x,
        sy: y,
        tx: x + Math.cos(a) * dist,
        ty: y + Math.sin(a) * dist,
        delay: Math.random() * 90,
        dur: 260 + Math.random() * 160,
        kind: 'out',
        color: colorOf(fromIcon, Math.random()),
      })
    }

    for (const { x, y } of cells(to)) {
      // 聚拢起点：从中心外一圈随机角度飞进来，看起来是「从散开的粒子里长出来」
      const a = Math.random() * Math.PI * 2
      const dist = 6 + Math.random() * 16
      particles.push({
        sx: C + Math.cos(a) * dist,
        sy: C + Math.sin(a) * dist,
        tx: x,
        ty: y,
        delay: 70 + Math.random() * 150,
        dur: 300 + Math.random() * 170,
        kind: 'in',
        color: colorOf(to, Math.random()),
      })
    }

    const total = Math.max(...particles.map((p) => p.delay + p.dur))

    const frame = () => {
      const t = performance.now() - now
      ctx.clearRect(0, 0, SIZE, SIZE)

      for (const p of particles) {
        const local = (t - p.delay) / p.dur
        if (local <= 0) {
          // 还没轮到：in 类不画（凭空出现会脏），out 类保持原位
          if (p.kind === 'out') {
            ctx.globalAlpha = 1
            ctx.fillStyle = p.color
            ctx.fillRect(p.sx - STEP / 2, p.sy - STEP / 2, STEP, STEP)
          }
          continue
        }

        const k = Math.min(local, 1)
        const e = easeOutCubic(k)
        const x = p.sx + (p.tx - p.sx) * e
        const y = p.sy + (p.ty - p.sy) * e

        // 散开的前 60% 保持不透明，后 40% 淡出；聚拢反过来
        ctx.globalAlpha = p.kind === 'out' ? 1 - Math.max(0, (k - 0.45) / 0.55) : Math.min(1, k * 1.8)
        ctx.fillStyle = p.color
        ctx.fillRect(x - STEP / 2, y - STEP / 2, STEP, STEP)
      }

      ctx.globalAlpha = 1
      if (t < total) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        drawSettled(to)
      }
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(frame)

    return () => cancelAnimationFrame(rafRef.current)
  }, [theme])

  return (
    <button
      type="button"
      onClick={onToggle}
      className="glass-thin flex items-center justify-center rounded-full"
      style={{ width: SIZE, height: SIZE }}
      aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
      title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
    >
      <canvas ref={canvasRef} width={SIZE * DPR} height={SIZE * DPR} style={{ width: SIZE, height: SIZE }} />
    </button>
  )
}
