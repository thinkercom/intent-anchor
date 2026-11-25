import { isDayComplete, dayStats, computeStreak } from '../src/lib/date.ts'
import { computeLongestStreak } from '../src/lib/stats.ts'
import type { Habit } from '../src/store/types.ts'

const mk = (id: string, createdAt: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  schedule: 'daily',
  createdAt,
  archived: false,
  ...extra,
})

const D = '2026-11-24' // 昨天
const T = '2026-11-25' // 今天
let fail = 0
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fail += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`)
}

// 1. 昨天 A 完成、B 没完成；今天把 B 删掉（archivedAt = 今天）
{
  const habits = [mk('A', D), mk('B', D, { archived: true, archivedAt: T })]
  const checkins = { [D]: ['A'] }
  check('删除后昨天仍是 1/2', dayStats(checkins, habits, D), { done: 1, total: 2, ratio: 0.5 })
  check('删除后昨天不算全勤', isDayComplete(checkins, habits, D), false)
  check('删除后连续天数仍为 0', computeStreak(checkins, habits, T), 0)
}

// 2. 昨天 A、B 都完成，今天删 B：昨天仍然全勤，连续 1 天
{
  const habits = [mk('A', D), mk('B', D, { archived: true, archivedAt: T })]
  const checkins = { [D]: ['A', 'B'] }
  check('删 B 后昨天仍全勤', isDayComplete(checkins, habits, D), true)
  check('删 B 后连续 1 天', computeStreak(checkins, habits, T), 1)
}

// 3. 昨天 A、B 都完成；昨天就归档了 B（archivedAt = 昨天）
//    → 昨天 B 不算数，分母只有 A，仍然是全勤（这是删除当天的合理口径）
{
  const habits = [mk('A', D), mk('B', D, { archived: true, archivedAt: D })]
  const checkins = { [D]: ['A', 'B'] }
  check('归档当天不算数', dayStats(checkins, habits, D), { done: 1, total: 1, ratio: 1 })
}

// 4. 老数据：archived 但没有 archivedAt，昨天没打卡 → 用「那天打过卡没有」兜底
{
  const habits = [mk('A', D), mk('B', D, { archived: true })]
  const checkins = { [D]: ['A'] }
  check('老归档数据兜底为 1/1', dayStats(checkins, habits, D), { done: 1, total: 1, ratio: 1 })
}

// 5. 全部习惯今天归档：今天不再要求打卡，历史最长连续不被抹掉
{
  const habits = [
    mk('A', D, { archived: true, archivedAt: T }),
    mk('B', D, { archived: true, archivedAt: T }),
  ]
  const checkins = { [D]: ['A', 'B'] }
  check('全归档后今天不算全勤', isDayComplete(checkins, habits, T), false)
  check('全归档后历史最长仍为 1', computeLongestStreak(checkins, habits, T), 1)
  check('全归档后当前连续为 1（昨天）', computeStreak(checkins, habits, T), 1)
}

// 6. 今天新加的习惯不影响昨天
{
  const habits = [mk('A', D), mk('B', T)]
  const checkins = { [D]: ['A'] }
  check('今天新加的不压低昨天', dayStats(checkins, habits, D), { done: 1, total: 1, ratio: 1 })
}

console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILED`)
if (fail) process.exitCode = 1
