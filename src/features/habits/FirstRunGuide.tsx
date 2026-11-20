import { useState } from 'react'
import { motion } from 'motion/react'
import { Hand, ArrowUpDown, Moon, ShieldCheck, X } from 'lucide-react'

/** 看过就记一下，别每次都弹（这是本机偏好，不进备份文件） */
const SEEN_KEY = 'intent-anchor-guide-seen'

const ROWS: { icon: typeof Hand; text: string }[] = [
  { icon: Hand, text: '轻触打卡，点错 5 秒内可撤销' },
  { icon: ArrowUpDown, text: '长按一行不动，轻微一震后上下拖动排序' },
  { icon: Moon, text: '凌晨 4 点换天，熬夜打的卡仍记当天' },
  { icon: ShieldCheck, text: '数据只在这台手机，设置 → 数据 可导出备份' },
]

export function FirstRunGuide({ visible }: { visible: boolean }) {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      return false
    }
  })

  if (!visible || seen) return null

  const dismiss = () => {
    setSeen(true)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // 隐私模式下写不进去也没关系，下次再看到一次而已
    }
  }

  return (
    <motion.div
      className="mt-4 rounded-2xl px-4 py-3"
      style={{ background: 'var(--glass)', border: '1px solid var(--card-border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] tracking-[0.15em]" style={{ color: 'var(--fg-muted)' }}>
          用法 · 看一遍就够
        </span>
        <button onClick={dismiss} className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--fg-muted)' }} aria-label="关闭引导">
          知道了
          <X size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {ROWS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2">
            <Icon size={12} className="shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
