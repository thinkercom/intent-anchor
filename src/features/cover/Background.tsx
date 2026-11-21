import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
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

/**
 * 保活：花朵绽放就是这个页面的主角，不能停。
 * iOS 低电量模式、首次进入未产生交互、后台切回，都可能让浏览器拒绝自动播放，
 * 于是画面停在 poster 上——看起来就是「动效被关掉了」。
 * 这里在多个时机重试 play()，失败也静默，不打断渲染。
 */
function useAutoplayRescue(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let stopped = false

    const tryPlay = () => {
      if (stopped || !video.paused) return
      const result = video.play()
      if (result && typeof result.catch === 'function') result.catch(() => {})
    }

    tryPlay()

    const onVisible = () => {
      if (!document.hidden) tryPlay()
    }

    video.addEventListener('loadeddata', tryPlay)
    video.addEventListener('canplay', tryPlay)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', tryPlay)
    window.addEventListener('touchstart', tryPlay, { passive: true })

    return () => {
      stopped = true
      video.removeEventListener('loadeddata', tryPlay)
      video.removeEventListener('canplay', tryPlay)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', tryPlay)
      window.removeEventListener('touchstart', tryPlay)
    }
  }, [ref])
}

export function Background({ theme }: Props) {
  const darkRef = useRef<HTMLVideoElement>(null)
  const lightRef = useRef<HTMLVideoElement>(null)
  useAutoplayRescue(darkRef)
  useAutoplayRescue(lightRef)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <video
        ref={darkRef}
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
        ref={lightRef}
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
      {/* 顶部与底部的柔和遮罩，保证文字在两种背景下都清晰。
          只留这一层——在视频上再叠任何全屏光晕/暗角，都会把花瓣压平 */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--veil)' }}
      />
    </div>
  )
}
