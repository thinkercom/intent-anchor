import { useEffect, useState } from 'react'
import { getLogicalDateKey, nextDayStart } from './date'

/**
 * 「逻辑今天」的日期键，跨过 04:00 会自动更新。
 *
 * 为什么要这样：页面一直开着时（很多人把 PWA 挂在后台），
 * 只用 `getLogicalDateKey()` 在渲染时算一次，凌晨 4 点以后回来看到的还是昨天的状态，
 * 打了卡才发现记到昨天去了。这里用两种手段兜住：
 * - 定时器精确卡在下一个 04:00 触发
 * - 页面重新可见 / 重新聚焦时立即重算（iOS 后台会冻结定时器，光靠 setTimeout 不可靠）
 */
export function useLogicalToday(): string {
  const [todayKey, setTodayKey] = useState(() => getLogicalDateKey())

  useEffect(() => {
    let timer: number | undefined

    const refresh = () => {
      setTodayKey((prev) => {
        const next = getLogicalDateKey()
        return next === prev ? prev : next
      })
      schedule()
    }

    const schedule = () => {
      if (timer) window.clearTimeout(timer)
      const next = nextDayStart()
      // +1s 缓冲，避免刚好卡在边界上算出前一天
      timer = window.setTimeout(refresh, Math.max(1000, next.getTime() - Date.now() + 1000))
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    schedule()
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return todayKey
}
