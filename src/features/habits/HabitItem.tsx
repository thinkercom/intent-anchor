import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import type { Habit } from '../../store/types'

interface Props {
  habit: Habit
  checked: boolean
  onToggle: () => void
  index: number
}

export function HabitItem({ habit, checked, onToggle, index }: Props) {
  return (
    <motion.button
      onClick={onToggle}
      className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: checked ? 'none' : 'var(--shadow)',
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* 勾选框 */}
      <motion.span
        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--fg-muted)'}`,
          background: checked ? 'var(--accent)' : 'transparent',
        }}
        animate={checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        {checked && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            style={{ color: 'var(--bg)' }}
          >
            <Check size={16} strokeWidth={2.5} />
          </motion.span>
        )}
      </motion.span>

      {/* 名称 */}
      <span
        className="flex-1 text-[15px] transition-colors"
        style={{
          color: checked ? 'var(--fg-muted)' : 'var(--fg)',
          textDecoration: checked ? 'line-through' : 'none',
          textDecorationColor: 'var(--fg-muted)',
        }}
      >
        {habit.name}
      </span>

      {/* 完成标记的光点 */}
      {checked && (
        <motion.span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--accent)' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
      )}
    </motion.button>
  )
}
