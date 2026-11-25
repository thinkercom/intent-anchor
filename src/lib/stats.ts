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

/**
 * 今天有没有「值得收尾」的内容：打过卡，或勾了今日意图。
 *
 * 收尾入口只在这之后出现。一天什么都没做的时候递上一句「结束今天」，
 * 读起来就是在提醒你今天又废了；那种日子最好的处理方式是安静地过去。
 */
export function hasDayActivity(
  checkins: Record<string, string[]>,
  todayKey: string,
  intentDone: Record<string, true>,
): boolean {
  return (checkins[todayKey]?.length ?? 0) > 0 || !!intentDone[todayKey]
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
  if (habits.length === 0) return 0

  // 起点要覆盖「已经归档的习惯」创建的那天：它们在归档之前是算数的，
  // 只从现存习惯算起会把删除前的那段成绩整段丢掉
  const candidates = [
    ...habits.map((h) => h.createdAt).filter((d): d is string => !!d),
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

export interface WeekHabit {
  name: string
  done: number
  total: number
}

export interface WeekSummary {
  weekStart: string
  weekEnd: string
  /** 一周累计完成次数 / 应完成次数 */
  done: number
  total: number
  ratio: number
  /** 全勤天数 */
  fullDays: number
  /** 有记录的天数 */
  activeDays: number
  best: WeekHabit | null
  worst: WeekHabit | null
}

/** 上一周（周一~周日）的日期范围。今天是周一时，上一周指刚过去的七天 */
export function lastWeekRange(todayKey: string): { start: string; end: string } {
  const thisMonday = mondayOf(todayKey)
  return { start: shiftDateKey(thisMonday, -7), end: shiftDateKey(thisMonday, -1) }
}

/**
 * 上周汇总。
 *
 * 分母只算「那几天已经存在的习惯」——上周三才加的习惯不应该背上周一二的账。
 * 最稳/最易断要求一周里至少存在 4 天，否则「最稳」可能只是刚加了两天的那个。
 */
export function weekSummary(
  checkins: Record<string, string[]>,
  habits: Habit[],
  todayKey: string,
): WeekSummary {
  const { start, end } = lastWeekRange(todayKey)
  const active = habits.filter((h) => !h.archived)

  let done = 0
  let total = 0
  let fullDays = 0
  let activeDays = 0
  let cursor = start
  for (let i = 0; i < 7; i += 1) {
    const s = dayStats(checkins, habits, cursor)
    done += s.done
    total += s.total
    if ((checkins[cursor] ?? []).length) activeDays += 1
    if (s.total > 0 && isDayComplete(checkins, habits, cursor)) fullDays += 1
    cursor = shiftDateKey(cursor, 1)
  }

  const perHabit: WeekHabit[] = active.map((habit) => {
    let hTotal = 0
    let hDone = 0
    let k = start
    for (let i = 0; i < 7; i += 1) {
      if (!habit.createdAt || habit.createdAt <= k) {
        hTotal += 1
        if ((checkins[k] ?? []).includes(habit.id)) hDone += 1
      }
      k = shiftDateKey(k, 1)
    }
    return { name: habit.name, done: hDone, total: hTotal }
  })
  const eligible = perHabit.filter((h) => h.total >= 4)

  let best: WeekHabit | null = null
  let worst: WeekHabit | null = null
  if (eligible.length >= 2) {
    const rate = (h: WeekHabit) => (h.total ? h.done / h.total : 0)
    best = eligible.reduce((a, b) => (rate(b) > rate(a) ? b : a))
    worst = eligible.reduce((a, b) => (rate(b) < rate(a) ? b : a))
    // 两边差不多时不硬分高下
    if (rate(best) - rate(worst) < 0.25) {
      best = null
      worst = null
    }
  }

  return {
    weekStart: start,
    weekEnd: end,
    done,
    total,
    ratio: total ? done / total : 0,
    fullDays,
    activeDays,
    best,
    worst,
  }
}
