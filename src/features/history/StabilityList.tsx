import { motion } from 'motion/react'
import type { HabitRate } from '../../lib/stats'

/** 少于这些天就直说「刚开始」，别用 0/1 这种数字让人以为已经掉队了 */
const EARLY_DAYS = 3

interface Props {
  rates: HabitRate[]
  mostId: string | null
  leastId: string | null
  windowDays: number
}

/**
 * 近 30 天的习惯稳定度。
 *
 * 不写成「最稳的是晨间伸展」这种一句话结论：那个标签只是入口，
 * 用户真正想看的是每个习惯各自掉了多少——断掉的那个往往才是真问题。
 */
export function StabilityList({ rates, mostId, leastId, windowDays }: Props) {
  const sorted = [...rates].sort((a, b) => b.rate - a.rate)

  return (
    <div className="surface rounded-2xl px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] tracking-wide" style={{ color: 'var(--fg)' }}>
          近 {windowDays} 天 · 稳定度
        </span>
        <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>
          按完成率排序
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          还没有在坚持的习惯。
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((r, i) => {
            const tag = r.habit.id === mostId ? '最稳' : r.habit.id === leastId ? '最易断' : null
            return (
              <div key={r.habit.id}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="truncate text-[12px]" style={{ color: 'var(--fg)' }}>
                    {r.habit.name}
                  </span>
                  {tag && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] leading-tight"
                      style={{
                        color: tag === '最稳' ? 'var(--bg)' : 'var(--fg-muted)',
                        background: tag === '最稳' ? 'var(--accent)' : 'transparent',
                        border: tag === '最稳' ? 'none' : '1px solid var(--card-border)',
                      }}
                    >
                      {tag}
                    </span>
                  )}
                  {r.total < EARLY_DAYS && (
                    <span className="shrink-0 text-[9px]" style={{ color: 'var(--fg-muted)' }}>
                      刚开始
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--fg-muted)' }}>
                    {r.done} / {r.total}
                  </span>
                </div>
                <div className="h-[3px] overflow-hidden rounded-full" style={{ background: 'var(--glass)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--accent)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(r.rate * 100)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
