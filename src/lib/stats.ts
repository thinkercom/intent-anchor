import { addDays, format, getDaysInMonth, parseISO } from 'date-fns'
import type { Habit, IntentDoneLog, IntentLog } from '../store/types'
import { dayStats, isDayComplete } from './date'
import type { DayStats } from './date'

/** 日期键加减天数。用逻辑日字符串而不是时刻，避免时区/夏令时把日期算偏 */
export function shiftDateKey(key: string, days: number): string {
  return format(addDays(parseISO(key), days), 'yyyy-MM-dd')
}

/** 0=周日 … 6=周六 */
export function weekdayOf(key: string): number {
  return parseISO(key).getDay()
}

/** 该日期所在周的周一 */
export function mondayOf(key: string): string {
  return shiftDateKey(key, -((weekdayOf(key) + 6) % 7))
}

export interface Overview {
  /** 累计打卡次数（含已归档习惯的历史记录） */
  totalCheckins: number
  /** 有打卡记录的天数 */
  activeDays: number
  /** 历史最长连续天数 */
  longestStreak: number
  /** 本月累计：完成次数 / 应完成次数 */
  monthDone: number
  monthTotal: number
  monthRate: number
  /** 本月有打卡的天数 */
  monthActiveDays: number
}

/**
 * 历史最长连续。
 *
 * 与 computeStreak 用同一个 isDayComplete，但因为要看「历史最好成绩」，
 * 必须从最早的一天正序扫到今天——倒着从今天数只能得到当前连续。
 * 起点取「最早创建日」和「最早打卡日」里更早的那个：老数据可能没有 createdAt。
 */
export function computeLongestStreak(
  checkins: Record<string, string[]>,
  habits: Habit[],
  todayKey: string,
): number {
  const active = habits.filter((h) => !h.archived)
  if (active.length === 0) return 0

  const candidates = [
    ...active.map((h) => h.createdAt).filter((d): d is string => !!d),
    ...Object.keys(checkins),
  ]
  if (candidates.length === 0) return 0
  const start = candidates.reduce((a, b) => (a < b ? a : b))
  if (start > todayKey) return 0

  let best = 0
  let run = 0
  let cursor = start
  // 防御脏数据造成的超长循环（20 年）
  for (let i = 0; i < 7300 && cursor <= todayKey; i += 1) {
    if (isDayComplete(checkins, habits, cursor)) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
    cursor = shiftDateKey(cursor, 1)
  }
  return best
}

/** 累计统计。月口径用「次数」而不是「天」，部分完成的那天不会被当成 0 也不当成 1 */
export function computeOverview(
  checkins: Record<string, string[]>,
  habits: Habit[],
  todayKey: string,
): Overview {
  let totalCheckins = 0
  let activeDays = 0
  for (const list of Object.values(checkins)) {
    if (list.length) activeDays += 1
    totalCheckins += list.length
  }

  const monthPrefix = todayKey.slice(0, 7)
  let monthDone = 0
  let monthTotal = 0
  let monthActiveDays = 0
  const days = Number(todayKey.slice(8, 10))
  for (let d = 1; d <= days; d += 1) {
    const key = `${monthPrefix}-${String(d).padStart(2, '0')}`
    const s = dayStats(checkins, habits, key)
    monthDone += s.done
    monthTotal += s.total
    if ((checkins[key] ?? []).length) monthActiveDays += 1
  }

  return {
    totalCheckins,
    activeDays,
    longestStreak: computeLongestStreak(checkins, habits, todayKey),
    monthDone,
    monthTotal,
    monthRate: monthTotal ? monthDone / monthTotal : 0,
    monthActiveDays,
  }
}

export interface HabitRate {
  habit: Habit
  done: number
  total: number
  rate: number
}

/**
 * 每个习惯在最近 windowDays 天里的完成率。
 * 分母只算它「已经存在」的天数，所以刚加的习惯不会一上来就是 0%。
 */
export function habitRates(
  checkins: Record<string, string[]>,
  habits: Habit[],
  todayKey: string,
  windowDays = 30,
): HabitRate[] {
  const from = shiftDateKey(todayKey, -(windowDays - 1))
  return habits
    .filter((h) => !h.archived)
    .map((habit) => {
      let total = 0
      let done = 0
      let cursor = from
      for (let i = 0; i < windowDays; i += 1) {
        if (!habit.createdAt || habit.createdAt <= cursor) {
          total += 1
          if ((checkins[cursor] ?? []).includes(habit.id)) done += 1
        }
        cursor = shiftDateKey(cursor, 1)
      }
      return { habit, done, total, rate: total ? done / total : 0 }
    })
}

/** 稳定度足够才配叫「最稳/最易断」——只打了 1 天的习惯没有统计意义 */
export const RATE_MIN_SAMPLE = 7

/**
 * 最稳与最易断。
 * 只有一个习惯时「最易断」就是它自己，没有对比意义，直接不返回。
 */
export function extremes(rates: HabitRate[]): { most: string | null; least: string | null } {
  const eligible = rates.filter((r) => r.total >= RATE_MIN_SAMPLE)
  if (eligible.length < 2) return { most: null, least: null }

  let most = eligible[0]
  let least = eligible[0]
  for (const r of eligible) {
    if (r.rate > most.rate) most = r
    if (r.rate < least.rate) least = r
  }
  // 完成率几乎一样时标谁都不公平
  if (most.rate - least.rate < 0.05) return { most: null, least: null }

  // 并列第一（三个习惯都是 30/30 那种）只标其中一个会让人以为其余两个更差，
  // 所以只在最值唯一时才打标签
  const sameMax = eligible.filter((r) => r.rate === most.rate).length > 1
  const sameMin = eligible.filter((r) => r.rate === least.rate).length > 1
  return { most: sameMax ? null : most.habit.id, least: sameMin ? null : least.habit.id }
}

export interface DayCell {
  key: string
  /** 1-31 */
  day: number
  inMonth: boolean
  /** 晚于今天（含下月补位）：不该显示完成度 */
  future: boolean
  today: boolean
  stats: DayStats
  hasRecord: boolean
  intent?: string
  intentDone: boolean
}

function makeCell(
  key: string,
  opts: {
    inMonth: boolean
    todayKey: string
    checkins: Record<string, string[]>
    habits: Habit[]
    intents: IntentLog
    intentDone: IntentDoneLog
  },
): DayCell {
  const done = opts.checkins[key] ?? []
  return {
    key,
    day: Number(key.slice(8, 10)),
    inMonth: opts.inMonth,
    future: key > opts.todayKey,
    today: key === opts.todayKey,
    stats: dayStats(opts.checkins, opts.habits, key),
    hasRecord: done.length > 0,
    intent: opts.intents[key],
    intentDone: !!opts.intentDone[key],
  }
}

/**
 * 月视图：固定 7 列、周一开头，前后用邻月的日子补满整周。
 * 返回的是扁平数组，渲染时按 7 个一组换行即可。
 */
export function monthCells(
  year: number,
  month: number,
  ctx: {
    todayKey: string
    checkins: Record<string, string[]>
    habits: Habit[]
    intents: IntentLog
    intentDone: IntentDoneLog
  },
): DayCell[] {
  const firstKey = `${year}-${String(month).padStart(2, '0')}-01`
  const lead = (weekdayOf(firstKey) + 6) % 7
  const daysInMonth = getDaysInMonth(parseISO(firstKey))
  // 补位后向上取整到整周，避免最后一行只有半行
  const total = Math.ceil((lead + daysInMonth) / 7) * 7
  const start = shiftDateKey(firstKey, -lead)

  return Array.from({ length: total }, (_, i) => {
    const key = shiftDateKey(start, i)
    return makeCell(key, { ...ctx, inMonth: key.slice(0, 7) === firstKey.slice(0, 7) })
  })
}

/**
 * 热力图：weeks 列 × 7 行，每列一周（周一到周日），最后一列是本周。
 * 返回按列分组，渲染时横向排 12 个竖列。
 */
export function heatmapWeeks(
  weeks: number,
  ctx: {
    todayKey: string
    checkins: Record<string, string[]>
    habits: Habit[]
    intents: IntentLog
    intentDone: IntentDoneLog
  },
): DayCell[][] {
  const firstMonday = shiftDateKey(mondayOf(ctx.todayKey), -(weeks - 1) * 7)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) =>
      makeCell(shiftDateKey(firstMonday, w * 7 + d), { ...ctx, inMonth: true }),
    ),
  )
}

/** 用于「这天完成了几个」的紧凑文案 */
export function dayLabel(key: string): string {
  return format(parseISO(key), 'M 月 d 日')
}
