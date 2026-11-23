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
 * 计算连续天数：从今天（或昨天，若今天尚未全部完成）往回数，
 * 连续「当天存在的习惯全部完成」的天数。漏一天即中断。
 *
 * 边界处理：
 * - 某天只要求「那天已经存在的习惯」完成，所以今天新加的习惯不会把之前的连续记录清零
 * - 归档（删除）的习惯不参与，历史记录不会因为删习惯而断掉
 * - 往前数到最早的习惯创建日就停，不需要看更早的空洞
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
  const list = habits.filter((h) => !h.archived)
  if (list.length === 0) return 0

  // 最早创建日：往前数到这里就够了（没有 createdAt 的旧数据视为「一直都存在」）
  const dated = list.map((h) => h.createdAt).filter((d) => !!d)
  const earliest = dated.length ? dated.reduce((a, b) => (a < b ? a : b)) : ''

  const isComplete = (key: string): boolean => {
    if (earliest && key < earliest) return false
    // 该逻辑日已经存在的习惯
    const existed = list.filter((h) => !h.createdAt || h.createdAt <= key)
    if (existed.length === 0) return false
    const done = checkins[key] ?? []
    return existed.every((h) => done.includes(h.id))
  }

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
 * 分母口径与 computeStreak 保持一致：
 * - 只算「那天已经存在」的习惯，今天新加的习惯不会把昨天的完成率压低
 * - 已归档的习惯不进分母，但那天如果确实打过卡，仍算分子
 *   （用户那天真的做了，历史不该因为他后来删掉这个习惯就抹掉）
 */
export function dayStats(
  checkins: Record<string, string[]>,
  habits: Habit[],
  key: string,
): DayStats {
  const done = checkins[key] ?? []
  const relevant = habits.filter(
    (h) => (!h.createdAt || h.createdAt <= key) && (!h.archived || done.includes(h.id)),
  )
  const count = relevant.filter((h) => done.includes(h.id)).length
  return {
    done: count,
    total: relevant.length,
    ratio: relevant.length ? count / relevant.length : 0,
  }
}
