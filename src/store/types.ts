export interface Intent {
  date: string
  text: string
}

export type HabitSchedule = 'daily' | 'weekly'

export interface Habit {
  id: string
  name: string
  schedule: HabitSchedule
  createdAt: string
  archived: boolean
}

export interface Reward {
  id: string
  threshold: number
  label: string
  category: string
  claimed: boolean
  // 首次达成条件的时刻：达成即视为「已解锁」，之后即使连续天数中断也仍可兑现
  unlockedAt?: string
  // 为未来的「推荐 Agent」预留字段
  mood?: string
  satisfaction?: number
  claimedAt?: string
}

export interface Telemetry {
  openCount: number
  // 从打开到进入功能卡的耗时（毫秒），取最近若干次
  enterDurations: number[]
  lastOpenAt?: string
  // 打卡动作次数
  checkinActions: number
}

export interface AppData {
  schemaVersion: number
  intent: Intent | null
  // 意图快捷选项（用户可自定义）
  intentPresets: string[]
  // 用户自己添加的第二行文案
  customPrompts: string[]
  habits: Habit[]
  checkins: Record<string, string[]> // date -> habitIds
  rewards: Reward[]
  telemetry: Telemetry
}

export type ViewName = 'cover' | 'menu' | 'habits' | 'settings'
