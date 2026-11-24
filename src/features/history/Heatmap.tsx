import type { DayCell } from '../../lib/stats'
import { dayLabel } from '../../lib/stats'

const CELL = 12
const GAP = 3
const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日']

/** 热力档位：0 表示那天没有记录。深色主题下 accent 很亮，满格给 0.88 就够，全屏 84 个格子一起亮会盖过月视图 */
const MAX_ALPHA = 0.88

function intensityOf(cell: DayCell): number {
  if (cell.future || !cell.hasRecord || cell.stats.total === 0) return 0
  if (cell.stats.done >= cell.stats.total) return MAX_ALPHA
  return (0.24 + cell.stats.ratio * 0.46) * MAX_ALPHA
}

function WeekGrid({ weeks, todayKey }: { weeks: DayCell[][]; todayKey: string }) {
  return (
    <div className="flex gap-2 pl-0.5">
      {/* 星期标签每两行一个，全标会挤成一团 */}
      <div className="flex flex-col" style={{ gap: GAP, width: 9 }}>
        {WEEKDAY_LABELS.map((d, i) => (
          <span
            key={i}
            className="text-[8px] leading-none"
            style={{ color: 'var(--fg-muted)', height: CELL, lineHeight: `${CELL}px` }}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="flex" style={{ gap: GAP }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
            {week.map((cell) => {
              const v = intensityOf(cell)
              return (
                <span
                  key={cell.key}
                  className="rounded-[3px]"
                  title={`${dayLabel(cell.key)} · ${
                    cell.future ? '还没到' : `${cell.stats.done}/${cell.stats.total}`
                  }`}
                  style={{
                    width: CELL,
                    height: CELL,
                    background: v > 0 ? 'var(--accent)' : 'var(--sunken-bg)',
                    opacity: v > 0 ? v : 1,
                    outline: cell.key === todayKey ? '1px solid var(--circle-ring)' : undefined,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 近 12 周热力图。列 = 周，行 = 周一…周日。
 *
 * 和月视图看着重复，但两者回答的是不同问题：
 * 月视图是「这个月具体哪几天断了」，热力图是一眼看三个月来的整体节奏。
 */
export function Heatmap({ weeks, todayKey }: { weeks: DayCell[][]; todayKey: string }) {
  const cells = weeks.flat()
  const active = cells.filter((c) => !c.future && c.hasRecord).length
  const complete = cells.filter(
    (c) => !c.future && c.hasRecord && c.stats.total > 0 && c.stats.done >= c.stats.total,
  ).length

  return (
    <div className="surface rounded-2xl px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] tracking-wide" style={{ color: 'var(--fg)' }}>
          近 12 周
        </span>
        <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>
          {active === 0 ? '还没有记录' : `全勤 ${complete} 天 · 有记录 ${active} 天`}
        </span>
      </div>

      {active === 0 ? (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          每一格是一天，打卡之后这里会按完成度亮起来。
        </p>
      ) : (
        <>
          <WeekGrid weeks={weeks} todayKey={todayKey} />
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>少</span>
            {[0.2, 0.4, 0.62, MAX_ALPHA].map((v) => (
              <span
                key={v}
                className="rounded-[3px]"
                style={{ width: 9, height: 9, background: 'var(--accent)', opacity: v }}
              />
            ))}
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>多</span>
            <span className="ml-auto text-[10px]" style={{ color: 'var(--fg-muted)' }}>
              {Number(cells[0]?.key.slice(5, 7))} 月 → {Number(todayKey.slice(5, 7))} 月
            </span>
          </div>
        </>
      )}
    </div>
  )
}
