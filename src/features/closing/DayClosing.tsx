import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { X, Undo2 } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAppStore } from '../../store/useAppStore'
import { dayStats } from '../../lib/date'
import { useLogicalToday } from '../../lib/useLogicalToday'

const NOTE_MAX = 100

/**
 * 今天的成绩，用一句话说。
 *
 * 只陈述事实，不给评价、不加形容词。收尾的时候人已经在做自我评估了，
 * 产品再补一句「你真棒」或「明天要加油」都是多余的。
 */
function resultLine(done: number, total: number, focusDone: boolean): string {
  if (total > 0 && done === total) return '今天全做完了'
  if (done > 0) return `今天做了 ${done} 件`
  if (focusDone) return '意图里那件事做完了'
  return '今天没有打卡，也可以到此为止'
}

/** 收尾时刻 -> '21:30'；导入的老数据可能没有时间，返回 null */
function closeTime(at: string | undefined): string | null {
  if (!at) return null
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return null
  return format(d, 'HH:mm')
}

interface Props {
  onClose: () => void
}

/**
 * 收尾面板。
 *
 * 它是这个产品里唯一一个「不要求你做任何事」的界面：
 * 不新增打卡、不改连续天数、不留待办。只是把今天合上，然后允许你带一句话走。
 *
 * 所以视觉上也刻意比别的面板安静 —— 没有图标色块，没有进度环，
 * 数字用衬线体单独站着，说明文字压到 11px。
 */
export function DayClosing({ onClose }: Props) {
  const todayKey = useLogicalToday()
  const habits = useAppStore((s) => s.habits)
  const checkins = useAppStore((s) => s.checkins)
  const intents = useAppStore((s) => s.intents)
  const intentDone = useAppStore((s) => s.intentDone)
  const dayCloses = useAppStore((s) => s.dayCloses)
  const closeDay = useAppStore((s) => s.closeDay)
  const reopenDay = useAppStore((s) => s.reopenDay)

  const existing = dayCloses[todayKey]
  const [note, setNote] = useState(existing?.note ?? '')
  const [closed, setClosed] = useState(false)

  const stats = dayStats(checkins, habits, todayKey)
  const intent = intents[todayKey] ?? ''
  const focusDone = !!intentDone[todayKey]
  const at = closeTime(existing?.at)

  // ESC 关闭：桌面端的常规预期
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 收好之后停一下再关：按钮点下去立刻消失，会让人不确定到底存没存
  useEffect(() => {
    if (!closed) return
    const t = window.setTimeout(onClose, 900)
    return () => window.clearTimeout(t)
  }, [closed, onClose])

  const submit = () => {
    if (closed) return
    closeDay(note, todayKey)
    setClosed(true)
  }

  const undo = () => {
    reopenDay(todayKey)
    onClose()
  }

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'var(--veil)' }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-closing-title"
        className="surface surface-hero relative z-10 w-full max-w-sm overflow-hidden rounded-3xl px-6 py-5"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        {closed ? (
          <motion.div
            className="flex flex-col items-center py-8"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="text-[15px] tracking-wide"
              style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}
            >
              今天收好了
            </span>
            {note.trim() && (
              <p
                className="mt-2 max-w-[16rem] text-center text-[12px] leading-relaxed"
                style={{ color: 'var(--fg-muted)' }}
              >
                明天打开时，你会看到这句话。
              </p>
            )}
          </motion.div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <span
                  id="day-closing-title"
                  className="text-[13px] tracking-[0.18em]"
                  style={{ color: 'var(--fg)' }}
                >
                  今天
                </span>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                  {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}
                  {at && ` · 已在 ${at} 收尾`}
                </p>
              </div>
              <motion.button
                onClick={onClose}
                className="-mr-1.5 -mt-1 rounded-full p-2"
                style={{ color: 'var(--fg-muted)' }}
                whileTap={{ scale: 0.9 }}
                aria-label="关闭"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* 成绩：数字自己站着，不加进度环、不加百分比 */}
            <div className="mt-5 flex items-baseline gap-1.5">
              <span
                className="text-[2.6rem] leading-none tracking-tight tabular-nums"
                style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}
              >
                {stats.done}
              </span>
              <span className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
                / {stats.total}
              </span>
              <span className="ml-auto text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                {resultLine(stats.done, stats.total, focusDone)}
              </span>
            </div>

            {intent && (
              <p
                className="mt-2.5 truncate text-[12px] leading-relaxed"
                style={{ color: 'var(--fg-muted)' }}
                title={intent}
              >
                今天你想的是「{intent}」{focusDone ? ' · 已完成' : ''}
              </p>
            )}

            <div className="hairline my-4" aria-hidden="true" />

            <label
              htmlFor="day-note"
              className="text-[11px] tracking-wider"
              style={{ color: 'var(--fg-muted)' }}
            >
              留一句给明天
              <span className="ml-2" style={{ opacity: 0.55 }}>
                可留空
              </span>
            </label>
            <textarea
              id="day-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              rows={2}
              maxLength={NOTE_MAX}
              placeholder="比如：明天先把最难的那件做完"
              className="field mt-2 w-full resize-none rounded-xl px-3 py-2.5 text-[13px] leading-relaxed outline-none"
            />

            <motion.button
              onClick={submit}
              className="btn-solid mt-4 w-full rounded-xl py-3 text-[14px]"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              whileTap={{ scale: 0.985 }}
            >
              {existing ? '保存' : '结束今天'}
            </motion.button>

            {existing && (
              <button
                onClick={undo}
                className="mx-auto mt-3 flex items-center gap-1 text-[11px]"
                style={{ color: 'var(--fg-muted)' }}
              >
                <Undo2 size={11} />
                撤销这次收尾
              </button>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
