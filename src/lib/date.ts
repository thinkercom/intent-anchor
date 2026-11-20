import { format, addDays, differenceInCalendarDays, parseISO } from 'date-fns'

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
 * 连续「全部习惯完成」的天数。漏一天即中断。
 *
 * @param checkins 打卡记录
 * @param activeHabitIds 当前启用的习惯 id
 * @param todayKey 逻辑今天
 */
export function computeStreak(
  checkins: Record<string, string[]>,
  activeHabitIds: string[],
  todayKey: string,
): number {
  if (activeHabitIds.length === 0) return 0

  const isComplete = (key: string): boolean => {
    const done = checkins[key] ?? []
    return activeHabitIds.every((id) => done.includes(id))
  }

  // 今天若已完成，从今天开始数；否则从昨天开始数（今天还有机会）
  let cursor = isComplete(todayKey) ? todayKey : prevDateKey(todayKey)
  let streak = 0
  while (isComplete(cursor)) {
    streak += 1
    cursor = prevDateKey(cursor)
  }
  return streak
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
