import type { Theme } from '../../lib/useTheme'

interface Props {
  theme: Theme
}

/**
 * 封面背景：深色/浅色两段循环视频交叉淡入淡出。
 * - 每段 video 常驻 DOM，通过 opacity 切换，避免切换时重新加载导致黑屏。
 * - poster 用同名静帧，视频未就绪时先显示静帧，杜绝闪跳。
 * - 资源路径带 BASE_URL，兼容 GitHub Pages 的 /<repo>/ 子路径部署。
 */
const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`

export function Background({ theme }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <video
        key="bg-dark"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms]"
        style={{ opacity: theme === 'dark' ? 1 : 0 }}
        src={asset('loop-dark.mp4')}
        poster={asset('bg-dark.png')}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <video
        key="bg-light"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms]"
        style={{ opacity: theme === 'light' ? 1 : 0 }}
        src={asset('loop-light.mp4')}
        poster={asset('bg-light.png')}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      {/* 顶部与底部的柔和遮罩，保证文字在两种背景下都清晰 */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--veil)' }}
      />
      {/* 场景光 + 暗角：没有明确光源的画面一定是平的 */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--scene-light), var(--scene-vignette)' }}
      />
    </div>
  )
}
