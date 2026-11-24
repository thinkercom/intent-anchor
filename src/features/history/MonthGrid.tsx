import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import type { Habit } from '../../store/types'
import type { DayCell } from '../../lib/stats'
import { dayLabel } from '../../lib/stats'
import { relevantHabits } from '../../lib/date'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

interface Props {
  cells: DayCell[]
  monthLabel: string
  onPrev: () => void
  onNext: () => void
  canNext: boolean
  selected: string | null
  onSelect: (key: string) => void
  habits: Habit[]
  checkins: Record<string, string[]>
}

/**
 * 完成度分档。
 *
 * 只有「全勤」整格染色，部分完成只在底部留一条进度线 ——
 * 一个月里大多数天都是「做了几个但没做完」，如果每天都染色，
 * 整页就是一排深浅不一的色块，反而看不出哪天真的做到了。
 */
function levelOf(cell: DayCell): number {
  if (!cell.hasRecord || cell.stats.total === 0) return 0
  if (cell.stats.done >= cell.stats.total) return 4
  return 1
}

export function MonthGrid({
  cells,
  monthLabel,
  onPrev,
  onNext,
  canNext,
  selected,
  onSelect,
  habits,
  checkins,
}: Props) {
  const detail = selected ? cells.find((c) => c.key === selected) : undefined
  const detailHabits = selected ? relevantHabits(checkins, habits, selected) : []
  const detailDone = selected ? (checkins[selected] ?? []) : []

  return (
    <div className="surface rounded-2xl px-4 py-4">
      {/* 月份切换：只让「看历史」，不让翻到未来 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] tracking-wide" style={{ color: 'var(--fg)' }}>
          {monthLabel}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onPrev}
            className="rounded-full p-1.5"
            style={{ color: 'var(--fg-muted)' }}
            aria-label="上个月"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={onNext}
            disabled={!canNext}
            className="rounded-full p-1.5"
            style={{ color: canNext ? 'var(--fg-muted)' : 'var(--fg-muted)', opacity: canNext ? 1 : 0.3 }}
            aria-label="下个月"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[10px]" style={{ color: 'var(--fg-muted)' }}>
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          // 补位的日子只提供「这是几号」的坐标，不显示完成度
          const level = cell.future || !cell.inMonth ? 0 : levelOf(cell)
          const full = level === 4
          const isSelected = cell.key === selected
          return (
            <button
              key={cell.key}
              onClick={() => onSelect(cell.key)}
              className="relative flex h-10 flex-col items-center justify-center overflow-hidden rounded-[10px]"
              style={{
                background: full ? 'var(--day-full-bg)' : 'var(--sunken-bg)',
                border: '1px solid transparent',
                // 选中画在格子外面（深色格子上画内框等于没有），
                // 「今天」画在格子里面，避免和相邻格子的外框挤成双线
                outline: isSelected ? '1.5px solid var(--fg)' : undefined,
                outlineOffset: isSelected ? 1.5 : undefined,
                boxShadow:
                  cell.today && !isSelected
                    ? `inset 0 0 0 1.5px ${
                        full
                          ? 'color-mix(in srgb, var(--day-full-fg) 40%, transparent)'
                          : 'color-mix(in srgb, var(--fg) 34%, transparent)'
                      }`
                    : undefined,
                opacity: cell.inMonth ? 1 : 0.3,
              }}
              aria-label={`${dayLabel(cell.key)}${
                cell.future ? '，未来' : `，完成 ${cell.stats.done} / ${cell.stats.total}`
              }`}
            >
              <span
                className="relative text-[11px] leading-none"
                style={{
                  color: full ? 'var(--day-full-fg)' : cell.future ? 'var(--fg-muted)' : 'var(--fg)',
                  fontWeight: cell.today ? 600 : 400,
                }}
              >
                {cell.day}
              </span>

              {/* 部分完成：底部一条很短的水位线，不抢日期数字的注意力 */}
              {level > 0 && !full && (
                <span
                  className="absolute bottom-[5px] left-1/2 h-[2px] -translate-x-1/2 rounded-full"
                  style={{
                    width: `${Math.max(22, cell.stats.ratio * 100)}%`,
                    maxWidth: '62%',
                    background: 'var(--accent)',
                    opacity: 0.72,
                  }}
                  aria-hidden="true"
                />
              )}

              {/* 有意图的日子给一个小点：打卡是「做了」，意图是「想做什么」，两件事 */}
              {cell.intent && (
                <span
                  className="absolute right-1 top-1 h-1 w-1 rounded-full"
                  style={{ background: full ? 'var(--day-full-fg)' : 'var(--accent)', opacity: 0.75 }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 图例：这套视觉语言（整格染色 / 底部短线 / 右上小点）必须能自己解释自己，
          否则用户只会看到一堆深浅不一的方块 */}
      <div className="mt-3 flex items-center gap-3.5 text-[10px]" style={{ color: 'var(--fg-muted)' }}>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--day-full-bg)' }} />
          全勤
        </span>
        <span className="flex items-center gap-1">
          <span
            className="relative h-3 w-3 rounded-[3px]"
            style={{ background: 'var(--sunken-bg)' }}
          >
            <span
              className="absolute bottom-[2px] left-[2px] h-[2px] w-[7px] rounded-full"
              style={{ background: 'var(--accent)', opacity: 0.72 }}
            />
          </span>
          部分完成
        </span>
        {cells.some((c) => c.inMonth && c.intent) && (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            设过意图
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {detail && (
          <motion.div
            key={detail.key}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26 }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 rounded-xl px-3 py-3"
              style={{ background: 'var(--sunken-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[12px]" style={{ color: 'var(--fg)' }}>
                  {dayLabel(detail.key)}
                  {detail.today && (
                    <span className="ml-1.5 text-[10px]" style={{ color: 'var(--accent)' }}>今天</span>
                  )}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                  {detail.future ? '还没到这一天' : `完成 ${detail.stats.done} / ${detail.stats.total}`}
                </span>
              </div>

              {detail.intent && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Sparkles size={11} style={{ color: 'var(--accent)' }} className="shrink-0" />
                  <span
                    className="truncate text-[12px]"
                    style={{
                      color: 'var(--fg)',
                      opacity: detail.intentDone ? 0.6 : 1,
                      textDecoration: detail.intentDone ? 'line-through' : 'none',
                    }}
                  >
                    {detail.intent}
                  </span>
                  {detail.intentDone && (
                    <Check size={11} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  )}
                </div>
              )}

              {detail.future ? null : detailHabits.length === 0 ? (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                  这天还没有习惯，是一片空白。
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                  {detailHabits.map((h) => {
                    const on = detailDone.includes(h.id)
                    return (
                      <span
                        key={h.id}
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: on ? 'var(--fg)' : 'var(--fg-muted)', opacity: on ? 1 : 0.66 }}
                      >
                        <span
                          className="flex h-2.5 w-2.5 items-center justify-center rounded-full"
                          style={{
                            border: `1px solid ${on ? 'var(--accent)' : 'var(--circle-ring)'}`,
                            background: on ? 'var(--accent)' : 'transparent',
                          }}
                        >
                          {on && <Check size={7} strokeWidth={4} style={{ color: 'var(--bg)' }} />}
                        </span>
                        {h.name}
                        {h.archived && (
                          <span className="text-[9px]" style={{ color: 'var(--fg-muted)' }}>已归档</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
