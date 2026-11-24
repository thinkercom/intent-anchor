import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Habit, Reward, ViewName } from './types'
import { SCHEMA_VERSION, STORE_KEY } from './schema'
import { normalizeAppData } from '../lib/exportImport'
import { getLogicalDateKey } from '../lib/date'

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
    intents: {},
    intentDone: {},
    reviewSeen: {},
    intentPresets: ['Deep work', 'Reading', 'Morning routine', 'Writing', 'Learning'],
    customPrompts: [],
    habits: DEFAULT_HABITS.map((h) => ({ ...h })),
    checkins: {},
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
    telemetry: { openCount: 0, enterDurations: [], checkinActions: 0 },
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

export type LoginProvider = 'phone' | 'email' | 'wechat'

export interface AuthUser {
  id: string                    // 当前 provider 的 uid
  name?: string | null
  masterKey: string             // 主账户键（规范化邮箱或手机号 uid），数据归属
  provider: LoginProvider       // 当前会话的登录方式
  email?: string | null         // 主账户邮箱（脱敏展示用，external/EdgeOne 版本）
  phone?: string | null         // 主账户手机号（脱敏展示用，WorkBuddy 现网）
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
  /** 设定某天（默认今天）的意图；传空字符串等于清除当天意图 */
  setIntent: (text: string, dateKey?: string) => void
  /** 勾选/取消「今日专项」完成状态 */
  toggleIntentDone: (dateKey?: string) => void
  /** 记住「这一周的回顾已经看过」，之后不再弹出 */
  dismissReview: (weekStart: string) => void
  addIntentPreset: (text: string) => void
  removeIntentPreset: (text: string) => void
  // 文案
  addCustomPrompt: (text: string) => void
  removeCustomPrompt: (text: string) => void
  // 习惯
  addHabit: (name: string) => void
  renameHabit: (id: string, name: string) => void
  removeHabit: (id: string) => void
  /** 按传入的启用习惯 id 顺序重排（用于长按拖动排序）；已归档的习惯排在末尾 */
  setHabitOrder: (orderedActiveIds: string[]) => void
  toggleCheckin: (habitId: string) => void
  /** 幂等设置某习惯某天的打卡状态（撤销用，避免与实际状态不一致） */
  setCheckin: (habitId: string, checked: boolean, dateKey?: string) => void
  // 奖励
  addReward: (reward: Omit<Reward, 'id' | 'claimed'>) => void
  updateReward: (id: string, patch: Partial<Omit<Reward, 'id' | 'claimed'>>) => void
  removeReward: (id: string) => void
  claimReward: (rewardId: string, mood?: string, satisfaction?: number) => void
  /** 记录「首次达成」时刻；已记录过的不会覆盖 */
  markRewardUnlocked: (rewardId: string) => void
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
      // 云端 / 导入来的数据同样先规范化，避免旧结构或残缺字段直接进 store
      applyRemoteData: (data) => set({ ...normalizeAppData(data) }),
      getDataSnapshot: () => {
        const s = get()
        return {
          schemaVersion: s.schemaVersion,
          intents: s.intents,
          intentDone: s.intentDone,
          reviewSeen: s.reviewSeen,
          intentPresets: s.intentPresets,
          customPrompts: s.customPrompts,
          habits: s.habits,
          checkins: s.checkins,
          rewards: s.rewards,
          telemetry: s.telemetry,
        }
      },

      // ---- 意图 ----
      /**
       * 写某天的意图（默认今天）。历史按日期留档，不再互相覆盖。
       * 传空字符串 = 清除当天意图（连同那天的「专项完成」标记一起清，
       * 否则会留下「已完成某件没写下的事」这种脏记录）。
       *
       * 同一天改文本时也清掉完成标记：完成是针对当初那个意图的，
       * 改成新目标后还挂着勾，历史里就会出现「阅读 ✓」但其实做的是写作。
       */
      setIntent: (text, dateKey) => {
        const key = dateKey ?? getLogicalDateKey()
        const t = text.trim()
        const intents = { ...get().intents }
        const intentDone = { ...get().intentDone }

        if (!t) {
          if (!(key in intents) && !(key in intentDone)) return
          delete intents[key]
          delete intentDone[key]
          set({ intents, intentDone })
          return
        }

        if (intents[key] === t) return
        intents[key] = t
        delete intentDone[key]
        set({ intents, intentDone })
      },
      toggleIntentDone: (dateKey) => {
        const key = dateKey ?? getLogicalDateKey()
        // 没有意图就没有「专项」可勾
        if (!get().intents[key]) return
        const intentDone = { ...get().intentDone }
        if (intentDone[key]) delete intentDone[key]
        else intentDone[key] = true
        set({ intentDone })
      },
      /** 关掉这一周的回顾：只记 weekStart，下周一算出来的是新的 key，自然会再出现 */
      dismissReview: (weekStart) => {
        if (get().reviewSeen[weekStart]) return
        set({ reviewSeen: { ...get().reviewSeen, [weekStart]: true } })
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
      /**
       * 拖动排序：按传入的启用习惯 id 顺序重排数组。
       * 已归档的习惯不参与展示，统一挪到末尾——它们只用于历史连续天数计算，顺序无意义。
       */
      setHabitOrder: (orderedActiveIds) => {
        const current = get().habits
        const byId = new Map(current.map((h) => [h.id, h]))
        const ordered: Habit[] = []
        for (const id of orderedActiveIds) {
          const h = byId.get(id)
          if (h && !h.archived) {
            ordered.push(h)
            byId.delete(id)
          }
        }
        const archived = current.filter((h) => h.archived)
        // 数量不一致（例如拖拽期间删了习惯）时保持原样，避免静默丢数据
        if (ordered.length + archived.length !== current.length) return
        set({ habits: [...ordered, ...archived] })
      },
      setCheckin: (habitId, checked, dateKey) => {
        const key = dateKey ?? getLogicalDateKey()
        const before = get().checkins
        const wasChecked = (before[key] ?? []).includes(habitId)
        if (wasChecked === checked) return
        const checkins = { ...before }
        const done = new Set(checkins[key] ?? [])
        if (checked) done.add(habitId)
        else done.delete(habitId)
        // 空的一天直接删掉 key，避免「记录天数」被空白日期夸大
        if (done.size) checkins[key] = [...done]
        else delete checkins[key]
        set({
          checkins,
          telemetry: { ...get().telemetry, checkinActions: get().telemetry.checkinActions + 1 },
        })
      },
      toggleCheckin: (habitId) => {
        const key = getLogicalDateKey()
        const done = get().checkins[key] ?? []
        get().setCheckin(habitId, !done.includes(habitId), key)
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
        const now = new Date().toISOString()
        const rewards = get().rewards.map((r) =>
          r.id === rewardId
            ? { ...r, claimed: true, claimedAt: now, unlockedAt: r.unlockedAt ?? now, mood, satisfaction }
            : r,
        )
        set({ rewards })
      },
      markRewardUnlocked: (rewardId) => {
        if (get().rewards.find((r) => r.id === rewardId)?.unlockedAt) return
        const now = new Date().toISOString()
        set({
          rewards: get().rewards.map((r) =>
            r.id === rewardId && !r.unlockedAt ? { ...r, unlockedAt: now } : r,
          ),
        })
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
      replaceAllData: (data) => set({ ...normalizeAppData(data) }),
      resetAll: () => set(initialData()),
    }),
    {
      name: STORE_KEY,
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        intents: state.intents,
        intentDone: state.intentDone,
        reviewSeen: state.reviewSeen,
        intentPresets: state.intentPresets,
        customPrompts: state.customPrompts,
        habits: state.habits,
        checkins: state.checkins,
        rewards: state.rewards,
        telemetry: state.telemetry,
      }),
      /**
       * 版本不一致时调用（不提供的话 zustand 会直接丢弃旧数据）。
       * 这里做**结构改写**，字段级兜底交给下面的 merge。
       */
      migrate: (persisted, fromVersion) => {
        const raw = (persisted ?? {}) as Record<string, unknown>
        if (fromVersion === SCHEMA_VERSION) return raw as unknown as AppStore

        // v1 -> v2：单条 intent 拆成按日期留档的 intents
        if (fromVersion < 2) {
          const legacy = raw.intent as { date?: unknown; text?: unknown } | null | undefined
          const intents: Record<string, string> = {}
          if (
            legacy &&
            typeof legacy.date === 'string' &&
            typeof legacy.text === 'string' &&
            legacy.text.trim()
          ) {
            intents[legacy.date] = legacy.text
          }
          raw.intents = intents
          raw.intentDone = {}
          delete raw.intent
        }

        // v2 -> v3：新增周回顾展示记录，老数据里没有，初始化为空
        if (fromVersion < 3) {
          raw.reviewSeen = {}
        }

        console.info(`[store] 数据从 v${fromVersion} 迁移到 v${SCHEMA_VERSION}`)
        return raw as unknown as AppStore
      },
      /**
       * 每次启动读到存储都会走这里：先规范化再合并。
       * 好处是损坏/残缺/旧结构的数据不会进入内存，页面不会因为脏数据白屏。
       *
       * 两个坑：
       * 1. 没有存档时 persist 也会调 merge（persisted 为 undefined），
       *    直接 normalize 会得到空数组，把默认习惯/奖励清空 —— 新设备首次打开就是空页面。
       * 2. 存档里缺某个字段时，也应该沿用默认值，而不是被空数组顶掉。
       */
      merge: (persisted, current) => {
        const raw = persisted as Record<string, unknown> | undefined
        if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return current
        const data = normalizeAppData(raw)
        const has = (key: keyof AppData) => raw[key] !== undefined
        return {
          ...current,
          ...data,
          intents: has('intents') ? data.intents : current.intents,
          intentDone: has('intentDone') ? data.intentDone : current.intentDone,
          reviewSeen: has('reviewSeen') ? data.reviewSeen : current.reviewSeen,
          intentPresets: has('intentPresets') ? data.intentPresets : current.intentPresets,
          customPrompts: has('customPrompts') ? data.customPrompts : current.customPrompts,
          habits: has('habits') ? data.habits : current.habits,
          checkins: has('checkins') ? data.checkins : current.checkins,
          rewards: has('rewards') ? data.rewards : current.rewards,
          telemetry: has('telemetry') ? data.telemetry : current.telemetry,
        }
      },
    },
  ),
)
