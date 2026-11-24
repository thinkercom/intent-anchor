import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Flame, TrendingUp } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useLogicalToday } from '../../lib/useLogicalToday'
import {
  computeOverview,
  extremes,
  habitRates,
  heatmapWeeks,
  monthCells,
} from '../../lib/stats'
import { MonthGrid } from './MonthGrid'
import { Heatmap } from './Heatmap'
import { StabilityList } from './StabilityList'

interface Props {
  onBack: () => void
}

const WINDOW_DAYS = 30

/** 'yyyy-MM' -> '2026 年 11 月' */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return `${y} 年 ${Number(m)} 月`
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 历史页：回答「我这段时间到底做得怎么样」。
 *
 * 习惯页只看今天，连续天数只看一条不断的长线——两者都看不见「哪几天断了、
 * 断在哪个习惯上」。这一页按「总览 → 这个月 → 三个月的节奏 → 单个习惯」由粗到细排。
 */
export function HistoryPage({ onBack }: Props) {
  const habits = useAppStore((s) => s.habits)
  const checkins = useAppStore((s) => s.checkins)
  const intents = useAppStore((s) => s.intents)
  const intentDone = useAppStore((s) => s.intentDone)
  const todayKey = useLogicalToday()

  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(null)

  const currentMonth = todayKey.slice(0, 7)
  const overview = useMemo(
    () => computeOverview(checkins, habits, todayKey),
    [checkins, habits, todayKey],
  )
  const rates = useMemo(
    () => habitRates(checkins, habits, todayKey, WINDOW_DAYS),
    [checkins, habits, todayKey],
  )
  const { most, least } = useMemo(() => extremes(rates), [rates])

  const cells = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number)
    return monthCells(y, m, { todayKey, checkins, habits, intents, intentDone })
  }, [monthKey, todayKey, checkins, habits, intents, intentDone])

  const weeks = useMemo(
    () => heatmapWeeks(12, { todayKey, checkins, habits, intents, intentDone }),
    [todayKey, checkins, habits, intents, intentDone],
  )

  const goMonth = (delta: number) => {
    setMonthKey((k) => shiftMonth(k, delta))
    setSelected(null)
  }

  return (
    <motion.main
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: 'var(--page-bg)' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4 }}
    >
      {/* 顶栏：标题绝对居中，与习惯页保持同一套位置 */}
      <div className="relative flex items-center justify-between px-2 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <motion.button
          onClick={onBack}
          className="rounded-full p-2"
          style={{ color: 'var(--fg-muted)' }}
          whileTap={{ scale: 0.92 }}
          aria-label="返回"
        >
          <ArrowLeft size={20} />
        </motion.button>
        <span
          className="absolute left-1/2 -translate-x-1/2 text-sm tracking-[0.2em]"
          style={{ color: 'var(--fg)' }}
        >
          历史
        </span>
        <span className="w-[35px]" aria-hidden="true" />
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* 总览 */}
        <motion.div
          className="surface surface-hero relative mb-4 rounded-[26px] px-6 pb-5 pt-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-end justify-between">
            <div>
              <span className="flex items-center gap-1.5 text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
                <TrendingUp size={13} />
                累计打卡
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className="text-[3rem] leading-none tracking-tight tabular-nums"
                  style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}
                >
                  {overview.totalCheckins}
                </span>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>次</span>
              </div>
              <span className="mt-1.5 block text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                {overview.activeDays} 天留下过记录
              </span>
            </div>

            <div className="text-right">
              <span className="flex items-center justify-end gap-1.5 text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
                <Flame size={13} />
                最长连续
              </span>
              <div className="mt-2 flex items-baseline justify-end gap-1.5">
                <span
                  className="text-[2rem] leading-none tracking-tight tabular-nums"
                  style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}
                >
                  {overview.longestStreak}
                </span>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>天</span>
              </div>
            </div>
          </div>

          <div className="hairline my-4" aria-hidden="true" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
              本月完成率
              <span className="ml-1.5" style={{ opacity: 0.62 }}>
                · {overview.monthActiveDays} 天有记录
              </span>
            </span>
            <span className="text-[12px] tabular-nums" style={{ color: 'var(--fg)' }}>
              {Math.round(overview.monthRate * 100)}%
              <span className="ml-2 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                {overview.monthDone} / {overview.monthTotal}
              </span>
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass)' }}>
            <motion.div
              className="liquid-bar h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overview.monthRate * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* 月视图 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <MonthGrid
            cells={cells}
            monthLabel={monthLabel(monthKey)}
            onPrev={() => goMonth(-1)}
            onNext={() => goMonth(1)}
            canNext={monthKey < currentMonth}
            selected={selected}
            onSelect={(key) => setSelected((k) => (k === key ? null : key))}
            habits={habits}
            checkins={checkins}
          />
        </motion.div>

        <div className="mt-3">
          <Heatmap weeks={weeks} todayKey={todayKey} />
        </div>

        <div className="mt-3">
          <StabilityList rates={rates} mostId={most} leastId={least} windowDays={WINDOW_DAYS} />
        </div>

        {overview.totalCheckins === 0 && (
          <p className="mt-4 px-2 text-center text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            这里会随打卡慢慢长出形状。先去勾一个，明天就能看见第一天。
          </p>
        )}
      </div>
    </motion.main>
  )
}
