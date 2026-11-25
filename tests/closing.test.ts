import { useAppStore } from '../src/store/useAppStore.ts'
import { hasDayActivity } from '../src/lib/stats.ts'
import { dayStats } from '../src/lib/date.ts'

let fail = 0
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fail += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`)
}

const D = '2026-05-04'
const T = '2026-05-05'

// ---- 收尾只是盖一个章，不能修改任何已有数据 ----
{
  const s = useAppStore.getState()
  const before = {
    checkins: JSON.parse(JSON.stringify(s.checkins)),
    intents: JSON.parse(JSON.stringify(s.intents)),
    intentDone: JSON.parse(JSON.stringify(s.intentDone)),
    habits: JSON.parse(JSON.stringify(s.habits)),
  }

  s.closeDay('明天先把最难的做完', D)

  const after = useAppStore.getState()
  check('收尾写入当天记录', after.dayCloses[D]?.note, '明天先把最难的做完')
  check('收尾带上了时间戳', typeof after.dayCloses[D]?.at === 'string' && after.dayCloses[D].at.length > 0, true)
  check('收尾没有改打卡', JSON.parse(JSON.stringify(after.checkins)), before.checkins)
  check('收尾没有改意图', JSON.parse(JSON.stringify(after.intents)), before.intents)
  check('收尾没有改专项完成', JSON.parse(JSON.stringify(after.intentDone)), before.intentDone)
  check('收尾没有改习惯', JSON.parse(JSON.stringify(after.habits)), before.habits)
}

// ---- 重复收尾：留言可改，收尾时刻保持第一次 ----
{
  const first = useAppStore.getState().dayCloses[D]
  useAppStore.getState().closeDay('改一个字', D)
  const again = useAppStore.getState().dayCloses[D]
  check('重复收尾更新留言', again?.note, '改一个字')
  check('重复收尾保留首次时刻', again?.at, first?.at)
}

// ---- 只盖章不留言也是合法状态 ----
{
  useAppStore.getState().closeDay(undefined, T)
  const rec = useAppStore.getState().dayCloses[T]
  check('空留言的收尾也有记录', rec?.note, '')
  check('空留言不计入没有记录', typeof rec?.at === 'string', true)
}

// ---- 撤销 ----
{
  useAppStore.getState().reopenDay(D)
  check('撤销后记录消失', useAppStore.getState().dayCloses[D], undefined)
  // 撤销一次不存在的不该报错，也不该造出空对象
  useAppStore.getState().reopenDay('2026-01-01')
  check('撤销不存在的日期无副作用', useAppStore.getState().dayCloses['2026-01-01'], undefined)
}

// ---- 收尾入口的出现条件 ----
{
  check('没打卡没勾意图 → 不出现入口', hasDayActivity({}, T, {}), false)
  check('有打卡 → 出现入口', hasDayActivity({ [T]: ['h1'] }, T, {}), true)
  check('只勾了意图 → 出现入口', hasDayActivity({}, T, { [T]: true }), true)
  check('昨天的记录不算今天', hasDayActivity({ [D]: ['h1'] }, T, { [D]: true }), false)
}

// ---- 收尾不进统计口径：统计只看打卡，收尾不改任何数字 ----
{
  const s = useAppStore.getState()
  const before = dayStats(s.checkins, s.habits, D)
  useAppStore.getState().closeDay('今天其实没做事', '2026-05-06')
  const after = useAppStore.getState()
  check('收尾没有让那天的统计变化', dayStats(after.checkins, after.habits, D), before)
}

if (fail) {
  console.error(`\n${fail} 条断言失败`)
  process.exitCode = 1
} else {
  console.log('ALL PASS')
}
