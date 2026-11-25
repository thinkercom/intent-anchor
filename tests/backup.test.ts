import { dataDigest } from '../src/lib/backup.ts'
import { useAppStore } from '../src/store/useAppStore.ts'
import { getLogicalDateKey } from '../src/lib/date.ts'

let fail = 0
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fail += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`)
}

// ---- 第 2 条：默认习惯的创建日应该是「今天」 ----
{
  const today = getLogicalDateKey()
  const s = useAppStore.getState()
  check('默认习惯数量', s.habits.length, 5)
  check(
    '默认习惯的 createdAt 全是今天',
    [...new Set(s.habits.map((h) => h.createdAt))],
    [today],
  )
  check('默认习惯都不带归档日期', s.habits.every((h) => !h.archivedAt), true)
}

// ---- 第 3 条：备份指纹能感知「内容级」改动 ----
const base = {
  habits: [
    { id: 'A', name: '阅读', schedule: 'daily' as const, createdAt: '2026-11-20', archived: false },
    { id: 'B', name: '冥想', schedule: 'daily' as const, createdAt: '2026-11-20', archived: false },
  ],
  checkins: { '2026-11-24': ['A', 'B'] },
  intents: { '2026-11-24': '写作' },
  intentDone: {} as Record<string, true>,
  intentPresets: ['Deep work'],
  customPrompts: ['今天要做什么？'],
  rewards: [{ id: 'r1', threshold: 7, label: '咖啡', category: '小奖励', claimed: false }],
  dayCloses: { '2026-11-24': { note: '明天继续', at: '2026-11-24T14:00:00.000Z' } },
}

const d0 = dataDigest(base)
check('同内容不同 key 顺序，指纹一致', dataDigest({ ...base, intentPresets: ['Deep work'] }), d0)
check(
  '同一天打卡顺序变化，指纹不变',
  dataDigest({ ...base, checkins: { '2026-11-24': ['B', 'A'] } }),
  d0,
)
check('改意图 → 指纹变', dataDigest({ ...base, intents: { '2026-11-24': '阅读笔记' } }) !== d0, true)
check(
  '改习惯名 → 指纹变',
  dataDigest({ ...base, habits: [{ ...base.habits[0], name: '读书' }, base.habits[1]] }) !== d0,
  true,
)
check(
  '改奖励阈值 → 指纹变',
  dataDigest({ ...base, rewards: [{ ...base.rewards[0], threshold: 10 }] }) !== d0,
  true,
)
check('勾选专项完成 → 指纹变', dataDigest({ ...base, intentDone: { '2026-11-24': true } }) !== d0, true)
check(
  '取消一天打卡、加另一天（条数不变）→ 指纹变',
  dataDigest({ ...base, checkins: { '2026-11-23': ['A', 'B'] } }) !== d0,
  true,
)
check(
  '改习惯顺序 → 指纹变（顺序本身也是数据）',
  dataDigest({ ...base, habits: [base.habits[1], base.habits[0]] }) !== d0,
  true,
)
check(
  '改收尾留言 → 指纹变（那是用户亲手写的）',
  dataDigest({
    ...base,
    dayCloses: { '2026-11-24': { note: '改成另一句', at: '2026-11-24T14:00:00.000Z' } },
  }) !== d0,
  true,
)

console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILED`)
if (fail) process.exitCode = 1
