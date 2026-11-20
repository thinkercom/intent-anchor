import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Habit, Reward, ViewName } from './types'
import { getLogicalDateKey } from '../lib/date'

const SCHEMA_VERSION = 1

const DEFAULT_HABITS: Habit[] = [
  { id: 'h1', name: '晨间伸展', schedule: 'daily', createdAt: '2026-11-19', archived: false },
  { id: 'h2', name: '冥想 10 分钟', schedule: 'daily', createdAt: '2026-11-19', archived: false },
  { id: 'h3', name: '阅读 20 页', schedule: 'daily', createdAt: '2026-11-19', archived: false },
  { id: 'h4', name: '深度工作 1 小时', schedule: 'daily', createdAt: '2026-11-19', archived: false },
  { id: 'h5', name: '睡前复盘', schedule: 'daily', createdAt: '2026-11-19', archived: false },
]

const DEFAULT_REWARDS: Reward[] = [
  { id: 'r1', threshold: 7, label: '一杯手冲咖啡', category: '小奖励', claimed: false },
  { id: 'r2', threshold: 14, label: '看一场电影', category: '中奖励', claimed: false },
  { id: 'r3', threshold: 30, label: '一次短途旅行', category: '大奖励', claimed: false },
]

function initialData(): AppData {
  // 返回全新对象/数组，避免重置后多个状态共享同一份常量引用
  return {
    schemaVersion: SCHEMA_VERSION,
    intent: null,
    intentPresets: ['Deep work', 'Reading', 'Morning routine', 'Writing', 'Learning'],
    customPrompts: [],
    habits: DEFAULT_HABITS.map((h) => ({ ...h })),
    checkins: {},
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
    telemetry: { openCount: 0, enterDurations: [], checkinActions: 0 },
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

export type LoginProvider = 'phone' | 'wechat'

export interface AuthUser {
  id: string                    // 当前 provider 的 uid
  name?: string | null
  masterKey: string             // 主账户键（手机号 uid），数据归属
  provider: LoginProvider       // 当前会话的登录方式
  phone?: string | null         // 主账户手机号（脱敏展示用）
  linkedWechat: boolean         // 主账户是否已挂载微信
}

interface AppActions {
  // 视图
  setView: (view: ViewName) => void
  // 云账号与同步
  setAuthUser: (user: AuthUser | null) => void
  setSyncStatus: (status: SyncStatus, message?: string) => void
  applyRemoteData: (data: AppData) => void
  // 取得当前需要同步的数据快照（供同步层使用）
  getDataSnapshot: () => AppData
  // 意图
  setIntent: (text: string) => void
  addIntentPreset: (text: string) => void
  removeIntentPreset: (text: string) => void
  // 文案
  addCustomPrompt: (text: string) => void
  removeCustomPrompt: (text: string) => void
  // 习惯
  addHabit: (name: string) => void
  renameHabit: (id: string, name: string) => void
  removeHabit: (id: string) => void
  toggleCheckin: (habitId: string) => void
  // 奖励
  addReward: (reward: Omit<Reward, 'id' | 'claimed'>) => void
  updateReward: (id: string, patch: Partial<Omit<Reward, 'id' | 'claimed'>>) => void
  removeReward: (id: string) => void
  claimReward: (rewardId: string, mood?: string, satisfaction?: number) => void
  // 埋点
  recordOpen: () => void
  recordEnter: (durationMs: number) => void
  // 数据
  replaceAllData: (data: AppData) => void
  resetAll: () => void
}

export interface AppStore extends AppData, AppActions {
  // 瞬时状态，不持久化
  view: ViewName
  openedAt: number
  authUser: AuthUser | null
  syncStatus: SyncStatus
  syncError: string
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialData(),
      view: 'cover',
      openedAt: Date.now(),
      authUser: null,
      syncStatus: 'idle',
      syncError: '',

      // ---- 视图 ----
      setView: (view) => set({ view }),

      // ---- 云账号与同步 ----
      setAuthUser: (user) => set({ authUser: user }),
      setSyncStatus: (status, message = '') => set({ syncStatus: status, syncError: message }),
      applyRemoteData: (data) => set({ ...data, schemaVersion: SCHEMA_VERSION }),
      getDataSnapshot: () => {
        const s = get()
        return {
          schemaVersion: s.schemaVersion,
          intent: s.intent,
          intentPresets: s.intentPresets,
          customPrompts: s.customPrompts,
          habits: s.habits,
          checkins: s.checkins,
          rewards: s.rewards,
          telemetry: s.telemetry,
        }
      },

      // ---- 意图 ----
      setIntent: (text) => {
        const t = text.trim()
        if (!t) return
        set({ intent: { date: getLogicalDateKey(), text: t } })
      },
      addIntentPreset: (text) => {
        const t = text.trim()
        if (!t || get().intentPresets.includes(t)) return
        set({ intentPresets: [...get().intentPresets, t] })
      },
      removeIntentPreset: (text) =>
        set({ intentPresets: get().intentPresets.filter((p) => p !== text) }),

      // ---- 文案 ----
      addCustomPrompt: (text) => {
        const t = text.trim()
        if (!t || get().customPrompts.includes(t)) return
        set({ customPrompts: [...get().customPrompts, t] })
      },
      removeCustomPrompt: (text) =>
        set({ customPrompts: get().customPrompts.filter((p) => p !== text) }),

      // ---- 习惯 ----
      addHabit: (name) => {
        const t = name.trim()
        if (!t) return
        const habit: Habit = {
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: t,
          schedule: 'daily',
          createdAt: getLogicalDateKey(),
          archived: false,
        }
        set({ habits: [...get().habits, habit] })
      },
      renameHabit: (id, name) => {
        const t = name.trim()
        if (!t) return
        set({ habits: get().habits.map((h) => (h.id === id ? { ...h, name: t } : h)) })
      },
      removeHabit: (id) => {
        // 软删除：标记 archived，历史打卡记录保留，避免破坏连续天数计算
        set({ habits: get().habits.map((h) => (h.id === id ? { ...h, archived: true } : h)) })
      },
      toggleCheckin: (habitId) => {
        const key = getLogicalDateKey()
        const checkins = { ...get().checkins }
        const done = checkins[key] ?? []
        checkins[key] = done.includes(habitId)
          ? done.filter((id) => id !== habitId)
          : [...done, habitId]
        set({
          checkins,
          telemetry: { ...get().telemetry, checkinActions: get().telemetry.checkinActions + 1 },
        })
      },

      // ---- 奖励 ----
      addReward: (reward) =>
        set({
          rewards: [...get().rewards, { ...reward, id: `r-${Date.now()}`, claimed: false }],
        }),
      updateReward: (id, patch) =>
        set({ rewards: get().rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      removeReward: (id) => set({ rewards: get().rewards.filter((r) => r.id !== id) }),
      claimReward: (rewardId, mood, satisfaction) => {
        const rewards = get().rewards.map((r) =>
          r.id === rewardId
            ? { ...r, claimed: true, claimedAt: new Date().toISOString(), mood, satisfaction }
            : r,
        )
        set({ rewards })
      },

      // ---- 埋点 ----
      recordOpen: () =>
        set({
          telemetry: {
            ...get().telemetry,
            openCount: get().telemetry.openCount + 1,
            lastOpenAt: new Date().toISOString(),
          },
          openedAt: Date.now(),
        }),
      recordEnter: (durationMs) =>
        set({
          telemetry: {
            ...get().telemetry,
            enterDurations: [...get().telemetry.enterDurations, durationMs].slice(-50),
          },
        }),

      // ---- 数据 ----
      // 注意：这里只提交数据、不切 view。
      // 视图切换由调用方在提交后延迟触发，避免「全量替换数据 + 切视图」同一批发生，
      // 导致正在 exit 的页面因数据突变重渲染、退出动画卡死（页面残留在 DOM 拦截点击）。
      replaceAllData: (data) => set({ ...data, schemaVersion: SCHEMA_VERSION }),
      resetAll: () => set(initialData()),
    }),
    {
      name: 'intent-anchor-store',
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        intent: state.intent,
        intentPresets: state.intentPresets,
        customPrompts: state.customPrompts,
        habits: state.habits,
        checkins: state.checkins,
        rewards: state.rewards,
        telemetry: state.telemetry,
      }),
    },
  ),
)
