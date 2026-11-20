import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
export type ThemeMode = 'auto' | Theme

const STORAGE_KEY = 'intent-anchor-theme-mode'

/** 深色时段：18:00 - 06:00；其余为浅色 */
function themeForHour(hour: number): Theme {
  return hour >= 18 || hour < 6 ? 'dark' : 'light'
}

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export interface ThemeController {
  theme: Theme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

/**
 * 主题控制：默认按系统时间自动切换（18–6 深色）；
 * 用户在首页点击切换按钮后，手动选择写入 localStorage 并优先于时间。
 */
export function useTheme(): ThemeController {
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [theme, setTheme] = useState<Theme>(() =>
    mode === 'auto' ? themeForHour(new Date().getHours()) : mode
  )

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      if (next === 'auto') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式下 localStorage 可能不可用，内存状态仍然生效
    }
    if (next !== 'auto') setTheme(next)
    else setTheme(themeForHour(new Date().getHours()))
  }, [])

  const toggle = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark')
  }, [setMode, theme])

  useEffect(() => {
    if (mode !== 'auto') return
    const evaluate = () => setTheme(themeForHour(new Date().getHours()))
    evaluate()
    // 每分钟检查一次，覆盖跨时段切换；visibilitychange 覆盖从后台回到前台
    const timer = window.setInterval(evaluate, 60_000)
    document.addEventListener('visibilitychange', evaluate)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', evaluate)
    }
  }, [mode])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // 同步更新浏览器/PWA 主题色，让地址栏与系统 UI 一起过渡
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07080c' : '#f4f2ec')
  }, [theme])

  return { theme, mode, setMode, toggle }
}
