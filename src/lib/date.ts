import { format, addDays, differenceInCalendarDays, parseISO } from 'date-fns'
import type { Habit } from '../store/types'

/** 一天的开始时刻：04:00。凌晨 0-4 点算作前一天。 */
export const DAY_START_HOUR = 4

/**
 * 取得「逻辑今天」的日期键。
 * 例如 2026-11-19 02:30 -> 返回 2026-11-18（因为还没到 04:00 切天）。
 */
export function getLogicalDateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - DAY_START_HOUR * 60 * 60 * 1000)
  return format(shifted, 'yyyy-MM-dd')
}

/** 逻辑日期键 -> Date（取该逻辑日 04:00 对应的时刻） */
export function dateKeyToDate(key: string): Date {
  const d = parseISO(key)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  return d
}

/** 返回某逻辑日的前一天日期键 */
export function prevDateKey(key: string): string {
  return format(addDays(dateKeyToDate(key), -1), 'yyyy-MM-dd')
}

/**
 * 某条习惯在某个逻辑日是否「有效」：那天它已经建立，且还没被归档。
 *
 * 这是所有历史统计的唯一口径——永远问「那天它算不算数」，
 * 而不是「它现在还在不在」。用当下的 archived 状态去回算过去，
 * 会让删除习惯变成改写历史：昨天没做 B，今天删掉 B，昨天就凭空成了全勤。
 *
 * 没有 archivedAt 的老数据（v3 及以前）不知道哪天删的，
 * 只有那天确实打过卡才认为它当时存在：这是唯一不会凭空多算一天的近似。
 */
export function isHabitActiveOn(habit: Habit, key: string, done: string[] = []): boolean {
  if (habit.createdAt && habit.createdAt > key) return false
  if (!habit.archived) return true
  if (habit.archivedAt) return habit.archivedAt > key
  return done.includes(habit.id)
}

/**
 * 某一天是否「全勤」：那天有效的习惯全部完成。
 *
 * 这是连续天数与最长连续共用的判定，抽出来是为了两处口径永远一致——
 * 否则历史页显示「最长 12 天」而习惯页显示「连续 7 天」，用户第一反应是数据错了。
 *
 * 边界处理：
 * - 只要求「那天已经存在、且尚未归档」的习惯完成；
 *   今天新加的习惯不会把之前的记录清零，今天删掉的习惯也不会让昨天变全勤
 * - 早于最早创建日的日期、以及一个有效习惯都没有的日期，一律不算
 */
export function isDayComplete(
  checkins: Record<string, string[]>,
  habits: Habit[],
  key: string,
): boolean {
  const done = checkins[key] ?? []
  const existed = habits.filter((h) => isHabitActiveOn(h, key, done))
  if (existed.length === 0) return false
  return existed.every((h) => done.includes(h.id))
}

/**
 * 计算连续天数：从今天（或昨天，若今天尚未全部完成）往回数，
 * 连续「当天存在的习惯全部完成」的天数。漏一天即中断。
 *
 * @param checkins 打卡记录
 * @param habits 全部习惯（内部自行过滤归档项）
 * @param todayKey 逻辑今天
 */
export function computeStreak(
  checkins: Record<string, string[]>,
  habits: Habit[],
  todayKey: string,
): number {
  const isComplete = (key: string) => isDayComplete(checkins, habits, key)

  // 今天若已完成，从今天开始数；否则从昨天开始数（今天还有机会）
  let cursor = isComplete(todayKey) ? todayKey : prevDateKey(todayKey)
  let streak = 0
  // 上限只是防御脏数据造成的死循环（10 年）
  while (streak < 3660 && isComplete(cursor)) {
    streak += 1
    cursor = prevDateKey(cursor)
  }
  return streak
}

/** 下一个逻辑日 04:00 的时刻（用于「跨天自动刷新」的定时器） */
export function nextDayStart(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  return d
}

/** 今日完成度 0-1 */
export function todayProgress(
  checkins: Record<string, string[]>,
  activeHabitIds: string[],
  todayKey: string,
): number {
  if (activeHabitIds.length === 0) return 0
  const done = checkins[todayKey] ?? []
  const count = activeHabitIds.filter((id) => done.includes(id)).length
  return count / activeHabitIds.length
}

/** 用 differenceInCalendarDays 做日期差（供需要的地方使用） */
export function daysBetween(fromKey: string, toKey: string): number {
  return differenceInCalendarDays(dateKeyToDate(toKey), dateKeyToDate(fromKey))
}

export interface DayStats {
  done: number
  total: number
  /** 0-1，total 为 0 时返回 0 */
  ratio: number
}

/**
 * 某一天的完成情况。
 *
 * 分母与 computeStreak 用同一个 isHabitActiveOn：
 * - 只算「那天有效」的习惯，今天新加的习惯不会把昨天的完成率压低
 * - 归档发生在今天之前的习惯不进分母（历史那天它还算数，归档之后就不算了）
 */
export function relevantHabits(
  checkins: Record<string, string[]>,
  habits: Habit[],
  key: string,
): Habit[] {
  const done = checkins[key] ?? []
  return habits.filter((h) => isHabitActiveOn(h, key, done))
}

export function dayStats(
  checkins: Record<string, string[]>,
  habits: Habit[],
  key: string,
): DayStats {
  const done = checkins[key] ?? []
  const relevant = relevantHabits(checkins, habits, key)
  const count = relevant.filter((h) => done.includes(h.id)).length
  return {
    done: count,
    total: relevant.length,
    ratio: relevant.length ? count / relevant.length : 0,
  }
}
