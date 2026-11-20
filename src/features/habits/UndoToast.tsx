import { AnimatePresence, motion } from 'motion/react'

export interface UndoInfo {
  id: string
  name: string
  /** 操作前的状态，撤销时写回这个值 */
  wasChecked: boolean
  /** 操作发生时的逻辑日期，撤销要写回同一天 */
  dateKey: string
}

interface Props {
  info: UndoInfo | null
  onUndo: () => void
  onDismiss: () => void
}

/**
 * 打卡撤销条：轻触打卡很容易误触（尤其单手操作），
 * 给 5 秒的后悔窗口，比去设置里翻记录靠谱得多。
 */
export function UndoToast({ info, onUndo, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {info && (
        <motion.div
          key="undo-toast"
          className="pointer-events-none absolute inset-x-4 z-40 flex justify-center"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <div
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-[13px]"
            style={{ background: 'var(--fg)', color: 'var(--bg)', boxShadow: 'var(--shadow)' }}
          >
            <span className="max-w-[52vw] truncate">
              {info.wasChecked ? '已取消打卡' : '已打卡'} · {info.name}
            </span>
            <button
              onClick={onUndo}
              className="shrink-0 rounded-full px-3 py-1 font-medium"
              style={{ background: 'var(--bg)', color: 'var(--fg)' }}
            >
              撤销
            </button>
            <button
              onClick={onDismiss}
              className="shrink-0 rounded-full px-2 py-1 opacity-60"
              aria-label="关闭提示"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
