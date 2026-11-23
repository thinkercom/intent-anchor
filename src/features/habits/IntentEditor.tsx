import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, Pencil, Check } from 'lucide-react'

interface Props {
  current: string
  /** 今天是否已经「把注意力给它了」 */
  done: boolean
  presets: string[]
  onSet: (text: string) => void
  onToggleDone: () => void
  onAddPreset: (text: string) => void
}

/**
 * 今日意图。
 *
 * v2 起这张卡同时承担「今日专项」的角色：右侧那个圈就是「今天把注意力给它了」。
 * 之前拆成两张卡（意图 + 专项），两行都写着「写作」，看着像重复。
 * 语义上本来就是一件事 —— 今天我想把时间给谁，以及我到底给了没有。
 *
 * 圈只在收起态出现：编辑的时候用户是在改目标，不该同时出现一个打卡按钮。
 */
export function IntentEditor({ current, done, presets, onSet, onToggleDone, onAddPreset }: Props) {
  // 当天还没有意图时默认展开，方便从封面的「设定今日意图」入口直接进入编辑
  const [editing, setEditing] = useState(!current)
  const [draft, setDraft] = useState('')

  const choose = (text: string) => {
    onSet(text)
    setEditing(false)
  }

  const submitCustom = () => {
    const t = draft.trim()
    if (!t) return
    onAddPreset(t)
    onSet(t)
    setDraft('')
    setEditing(false)
  }

  return (
    <div className={`rounded-2xl px-4 py-3.5 ${done && !editing ? 'surface-sunken' : 'surface'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className="flex items-center gap-1.5 text-[11px] tracking-wider"
            style={{ color: 'var(--fg-muted)' }}
          >
            <Sparkles size={13} />
            今日意图
          </span>
          <p
            className="mt-1.5 text-[15px] leading-snug"
            style={{ color: 'var(--fg)', opacity: done ? 0.62 : 1 }}
          >
            {current || '还没有设定今天的意图'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px]"
            style={{ color: 'var(--accent)' }}
          >
            {editing ? <Check size={12} /> : <Pencil size={12} />}
            {editing ? '收起' : '编辑'}
          </button>

          {/* 只有在有意图、且不在编辑时，才提供「完成了」这个动作 */}
          {current && !editing && (
            <motion.button
              onClick={onToggleDone}
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                border: `1px solid ${done ? 'var(--accent)' : 'var(--circle-ring)'}`,
                background: done ? 'var(--accent)' : 'var(--circle-fill)',
                boxShadow: done ? 'var(--circle-light)' : 'inset 0 1px 1px rgba(0,0,0,0.04)',
              }}
              animate={done ? { scale: [1, 1.18, 1] } : { scale: 1 }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
              whileTap={{ scale: 0.9 }}
              aria-label={done ? `今日意图「${current}」已完成，轻触取消` : `标记今日意图「${current}」为完成`}
            >
              {done && <Check size={13} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => choose(p)}
                  className="rounded-full px-3 py-1.5 text-xs"
                  style={{
                    background: p === current ? 'var(--accent)' : 'var(--glass)',
                    color: p === current ? 'var(--bg)' : 'var(--fg)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
                placeholder="输入自定义意图…"
                className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg)' }}
              />
              <button
                onClick={submitCustom}
                className="rounded-xl px-4 text-sm"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                设定
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
