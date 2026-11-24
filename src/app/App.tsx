import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTheme } from '../lib/useTheme'
import { useAppStore } from '../store/useAppStore'
import { restoreSession } from '../lib/cloud'
import { isCloudEnabled } from '../lib/cloudConfig'
import { onSignedIn, onSignedOut } from '../lib/syncManager'
import { Background } from '../features/cover/Background'
import { CoverPage } from '../features/cover/CoverPage'
import { ActionMenu } from '../features/action-menu/ActionMenu'
import { HabitPage } from '../features/habits/HabitPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AuthScreen } from '../features/auth/AuthScreen'
import type { ViewName } from '../store/types'
import type { AuthUser } from '../store/useAppStore'

type AuthPanel = null | 'login' | 'bind'

export default function App() {
  const { theme, mode: themeMode, setMode: setThemeMode, toggle: toggleTheme } = useTheme()
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const openedAt = useAppStore((s) => s.openedAt)
  const recordOpen = useAppStore((s) => s.recordOpen)
  const recordEnter = useAppStore((s) => s.recordEnter)
  const setAuthUser = useAppStore((s) => s.setAuthUser)
  const setSyncStatus = useAppStore((s) => s.setSyncStatus)
  const recordedRef = useRef(false)
  const authCheckedRef = useRef(false)
  const [authPanel, setAuthPanel] = useState<AuthPanel>(null)

  // 统一处理登录成功：交给 store + 同步层
  const applySignedIn = (user: AuthUser) => {
    setAuthUser(user)
    void onSignedIn(user.masterKey)
  }

  // 启动：处理回调 / 恢复会话（必须在任何门控之前）
  useEffect(() => {
    if (!isCloudEnabled) return
    if (authCheckedRef.current) return
    authCheckedRef.current = true
    ;(async () => {
      const result = await restoreSession()
      if (result.error) {
        setSyncStatus('error', result.error)
        return
      }
      if (result.user) {
        applySignedIn(result.user)
      } else if (result.needBindConfirm) {
        setAuthPanel('bind')
      }
      // 游客：保持现有体验，正常进封面
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (recordedRef.current) return
    recordedRef.current = true
    recordOpen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBegin = () => {
    recordEnter(Date.now() - openedAt)
    setView('menu')
  }

  const navigate = (v: ViewName) => setView(v)

  const handleAuthDone = (user: AuthUser, justBound: boolean) => {
    applySignedIn(user)
    setAuthPanel(null)
    // 绑定完成后回到设置页的数据 tab 让用户看到状态
    if (justBound) setView('settings')
  }

  const handleLogoutDone = () => {
    setAuthUser(null)
    onSignedOut()
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Background theme={theme} />

      {/* 各页面全屏绝对定位、互相覆盖，用并行过渡，避免 mode="wait" 卡死 */}
      <AnimatePresence initial={false}>
        {view === 'cover' && (
          <CoverPage
            key="cover"
            onBegin={handleBegin}
            theme={theme}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
            onResetTheme={() => setThemeMode('auto')}
          />
        )}
        {view === 'menu' && (
          <ActionMenu key="menu" onClose={() => setView('cover')} onNavigate={navigate} />
        )}
        {view === 'habits' && (
          <HabitPage
            key="habits"
            onBack={() => setView('menu')}
            onOpenSettings={() => setView('settings')}
            onOpenHistory={() => setView('history')}
          />
        )}
        {view === 'history' && (
          <HistoryPage key="history" onBack={() => setView('habits')} />
        )}
        {view === 'settings' && (
          <SettingsPage
            key="settings"
            onBack={() => setView('habits')}
            onDataApplied={() => setView('cover')}
            onRequestLogin={() => setAuthPanel('login')}
            onRequestBind={() => setAuthPanel('bind')}
            onLogoutDone={handleLogoutDone}
          />
        )}
      </AnimatePresence>

      {/* 登录 / 绑定覆盖层：仅 WorkBuddy 云版本显示；EdgeOne 静态版为游客模式 */}
      <AnimatePresence>
        {isCloudEnabled && authPanel && (
          <AuthScreen
            key={authPanel}
            mode={authPanel}
            onClose={() => setAuthPanel(null)}
            onGuest={() => setAuthPanel(null)}
            onSignedIn={handleAuthDone}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
