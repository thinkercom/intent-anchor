import { motion } from 'motion/react'
import { ArrowLeft, CheckCheck } from 'lucide-react'
import type { ViewName } from '../../store/types'

interface Props {
  onClose: () => void
  onNavigate: (view: ViewName) => void
}

export function ActionMenu({ onClose, onNavigate }: Props) {
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 背景虚化 */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'var(--veil)' }}
        onClick={onClose}
      />

      <motion.div
        layoutId="action-panel"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl p-6"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow)',
          backdropFilter: 'blur(20px)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <motion.button
            onClick={onClose}
            className="rounded-full p-2"
            style={{ color: 'var(--fg-muted)' }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label="返回"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <span className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--fg-muted)' }}>
            Choose
          </span>
          <span className="w-8" />
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
        >
          <motion.button
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            onClick={() => onNavigate('habits')}
            className="flex w-full items-center gap-4 rounded-2xl p-4 text-left"
            style={{ background: 'var(--glass)', border: '1px solid var(--card-border)' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <CheckCheck size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-base" style={{ color: 'var(--fg)' }}>
                习惯养成
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--fg-muted)' }}>
                Habit · 每日打卡与连续天数
              </span>
            </span>
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
