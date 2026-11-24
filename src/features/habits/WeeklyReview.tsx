import { motion } from 'motion/react'
import { X } from 'lucide-react'
import type { WeekSummary } from '../../lib/stats'

interface Props {
  summary: WeekSummary
  onDismiss: () => void
}

/** 'yyyy-MM-dd' -> '11/17' */
function shortDate(key: string): string {
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`
}

/**
 * 一句引导。
 *
 * 原则：不评价人格（「你很棒 / 你又没坚持住」），只描述事实 + 给一个更小的动作。
 * 完成率越低，给的动作越小 —— 断掉的时候人最需要的不是目标，是台阶。
 */
function reviewNote(s: WeekSummary): string {
  if (s.ratio >= 0.9) return '上周几乎没断过。这周试着只守一件事，把它做到每天都不断。'
  if (s.ratio >= 0.65) {
    return s.worst
      ? `整体在走，只有「${s.worst.name}」容易松。把它拆小一点，做完一半也算。`
      : '整体在走。挑一件这周做得最勉强的，把它改小。'
  }
  if (s.ratio >= 0.35) return '上周大约一半的日子动了。先别加新的——把最容易断的那个改小。'
  return '上周只动了几次。今天挑最小的一件做完，重新开始不用等周一。'
}

export function WeeklyReview({ summary, onDismiss }: Props) {
  const { done, total, ratio, fullDays, best, worst, weekStart, weekEnd } = summary

  return (
    <motion.div
      className="surface mb-4 rounded-2xl px-4 py-3.5"
      initial={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 16 }}
      exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
          上周回顾
          <span className="ml-1.5" style={{ opacity: 0.7 }}>
            {shortDate(weekStart)} – {shortDate(weekEnd)}
          </span>
        </span>
        <button
          onClick={onDismiss}
          className="-mr-1 rounded-full p-1"
          style={{ color: 'var(--fg-muted)' }}
          aria-label="收起上周回顾，本周不再显示"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-1.5 flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[1.9rem] leading-none tracking-tight tabular-nums"
            style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}
          >
            {done}
          </span>
          <span className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
            / {total} 次
          </span>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          全勤 <span style={{ color: 'var(--fg)' }}>{fullDays}</span> 天
        </span>
      </div>

      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass)' }}>
        <motion.div
          className="liquid-bar h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(ratio * 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {(best || worst) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
          {best && (
            <span style={{ color: 'var(--fg-muted)' }}>
              最稳 <span style={{ color: 'var(--fg)' }}>{best.name}</span> {best.done}/{best.total}
            </span>
          )}
          {best && worst && (
            <span style={{ color: 'var(--fg-muted)', opacity: 0.5 }} aria-hidden="true">·</span>
          )}
          {worst && (
            <span style={{ color: 'var(--fg-muted)' }}>
              掉得最多 <span style={{ color: 'var(--fg)' }}>{worst.name}</span> {worst.done}/{worst.total}
            </span>
          )}
        </div>
      )}

      <div className="hairline my-2.5" aria-hidden="true" />

      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        {reviewNote(summary)}
      </p>
    </motion.div>
  )
}
