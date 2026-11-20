import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, Pencil, Check } from 'lucide-react'

interface Props {
  current: string
  presets: string[]
  onSet: (text: string) => void
  onAddPreset: (text: string) => void
}

export function IntentEditor({ current, presets, onSet, onAddPreset }: Props) {
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
    <div className="rounded-2xl px-4 py-3.5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
          <Sparkles size={13} />
          今日意图
        </span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--accent)' }}
        >
          {editing ? <Check size={12} /> : <Pencil size={12} />}
          {editing ? '收起' : '编辑'}
        </button>
      </div>

      <p className="text-[15px]" style={{ color: 'var(--fg)' }}>
        {current || '还没有设定今天的意图'}
      </p>

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
