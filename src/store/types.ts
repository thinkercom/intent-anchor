/**
 * 每日意图留档：date -> 文本。
 *
 * v1 时意图只有一条（`intent: {date, text}`），设新的就覆盖旧的，
 * 结果是产品名叫 intent-anchor、但「意图」本身没有任何历史。
 * v2 起按日期留档，历史全部保留。
 */
export type IntentLog = Record<string, string>

/** 「今日专项」是否完成：date -> true（未完成不存 key，避免空值把地图撑起来） */
export type IntentDoneLog = Record<string, true>

/**
 * 周回顾是否已经展示过：weekStart(周一) -> true。
 *
 * 存「已经看过」而不是「下次该看哪一周」，因为用户可能一周都没打开 App，
 * 下次打开时该看的是「上一周」——那是相对当前时间算出来的，不需要持久化。
 */
export type ReviewSeenLog = Record<string, true>

export type HabitSchedule = 'daily' | 'weekly'

export interface Habit {
  id: string
  name: string
  schedule: HabitSchedule
  createdAt: string
  archived: boolean
  /**
   * 归档（软删除）发生在哪个逻辑日（v4 起）。
   *
   * 没有它的话，「昨天是否全勤」只能用习惯**现在**的归档状态来判断——
   * 昨天没做 B、今天把 B 删掉，昨天就凭空变成 100%，连续天数也跟着涨。
   * 有它之后，历史按「那一天有效的习惯」算：B 在归档日之前都算数。
   *
   * 老数据可能只有 archived: true，迁移时补上当天日期。
   */
  archivedAt?: string
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
  /** 每日意图留档（v2 起）。读当天意图用 intents[dateKey] */
  intents: IntentLog
  /** 今日专项是否完成（v2 起） */
  intentDone: IntentDoneLog
  /** 周回顾展示记录（v3 起） */
  reviewSeen: ReviewSeenLog
  // 意图快捷选项（用户可自定义）
  intentPresets: string[]
  // 用户自己添加的第二行文案
  customPrompts: string[]
  habits: Habit[]
  checkins: Record<string, string[]> // date -> habitIds
  rewards: Reward[]
  telemetry: Telemetry
}

export type ViewName = 'cover' | 'menu' | 'habits' | 'history' | 'settings'
