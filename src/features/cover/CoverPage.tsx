import { motion } from 'motion/react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAppStore } from '../../store/useAppStore'
import { computeStreak } from '../../lib/date'
import { useLogicalToday } from '../../lib/useLogicalToday'
import { HEADLINE_LINES, promptForDate } from '../../lib/prompts'
import type { Theme, ThemeMode } from '../../lib/useTheme'
import type { ViewName } from '../../store/types'
import { FlowerHeadline } from './FlowerHeadline'
import { PixelThemeToggle } from './PixelThemeToggle'

interface Props {
  onBegin: () => void
  theme: Theme
  themeMode: ThemeMode
  onToggleTheme: () => void
  onResetTheme: () => void
}

export function CoverPage({ onBegin, theme, themeMode, onToggleTheme, onResetTheme }: Props) {
  const customPrompts = useAppStore((s) => s.customPrompts)
  const checkins = useAppStore((s) => s.checkins)
  const habits = useAppStore((s) => s.habits)
  const intent = useAppStore((s) => s.intent)
  const setView = useAppStore((s) => s.setView)

  const todayKey = useLogicalToday()
  const prompt = promptForDate(todayKey, customPrompts)
  const activeIds = habits.filter((h) => !h.archived).map((h) => h.id)
  const streak = computeStreak(checkins, habits, todayKey)
  const todayLabel = format(new Date(), 'M月d日 EEEE', { locale: zhCN })

  // 打断回归：当天已设意图但未全部完成时，显示「你刚才要做的是 X」
  const doneToday = checkins[todayKey] ?? []
  const intentPending =
    intent &&
    intent.text &&
    intent.date === todayKey &&
    activeIds.length > 0 &&
    !activeIds.every((id) => doneToday.includes(id))

  // 当天有效意图（跨天后视为过期，不显示回归提示）
  const todayIntent = intent && intent.date === todayKey ? intent.text : ''
  const go = (view: ViewName) => setView(view)

  return (
    <motion.main
      className="absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center px-6"
      // 关键：容器不做 opacity 入场，始终可见。
      // 之前用 initial={{opacity:0}} 时，从设置页重置/导入切回封面，
      // 在 AnimatePresence 模式下新挂载的容器会卡在 opacity:0，
      // 导致「背景在、文字按钮全没了」。保留 exit 让离开仍有过渡。
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 明暗切换：默认跟随时间，点击后手动锁定；「自动」可恢复跟随时间 */}
      <div
        className="absolute right-4 z-20 flex items-center gap-1.5"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {themeMode !== 'auto' && (
          <motion.button
            onClick={onResetTheme}
            className="glass-thin rounded-full px-2.5 py-1.5 text-[10px] tracking-wider"
            style={{ color: 'var(--fg-muted)' }}
            whileTap={{ scale: 0.94 }}
            aria-label="恢复按时间自动切换主题"
          >
            自动
          </motion.button>
        )}
        <PixelThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      {/* 主视觉 + 今日提问。整体略上移，给 Begin 留出呼吸 */}
      <div className="flex w-full max-w-[21rem] flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <FlowerHeadline
            lines={[...HEADLINE_LINES]}
            className="text-[clamp(2.5rem,12vw,3.6rem)] md:text-[4.4rem]"
          />
        </motion.div>

        {/* 今日提问：主视觉之后的第二层，字号压到「注释」的量级，
            但保持可读 —— 它是这个产品的真正内容，不是装饰 */}
        <motion.div
          className="mt-8 flex w-full flex-col items-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.6 }}
        >
          <div className="hairline w-16" />
          <p
            className="text-on-media mt-5 text-balance text-[0.98rem] leading-[1.7] md:text-[1.1rem]"
            style={{ color: 'var(--fg)', opacity: 0.78 }}
          >
            {prompt}
          </p>
        </motion.div>

        {/* 打断回归 / 意图入口 */}
        {todayIntent ? (
          <motion.button
            onClick={() => go('habits')}
            className="glass-thin text-on-media mt-5 max-w-full truncate rounded-full px-4 py-2 text-xs"
            style={{ color: 'var(--fg-muted)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24, duration: 0.45 }}
            whileTap={{ scale: 0.97 }}
          >
            {intentPending ? '你刚才要做的是' : '今日意图'}「{todayIntent}」→
          </motion.button>
        ) : (
          <motion.button
            onClick={() => go('habits')}
            className="text-on-media mt-5 rounded-full px-4 py-2 text-xs"
            style={{ color: 'var(--fg-muted)', border: '1px dashed var(--card-border)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24, duration: 0.45 }}
            whileTap={{ scale: 0.97 }}
          >
            + 设定今日意图
          </motion.button>
        )}

        {/* 中心按钮：极薄球。球体必须留高光，但收窄到左上一点 */}
        <motion.button
          onClick={onBegin}
          className="orb-thin mt-11 flex h-28 w-28 items-center justify-center rounded-full text-sm tracking-[0.15em] md:h-32 md:w-32"
          style={{ color: 'var(--fg)' }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26, duration: 0.55, type: 'spring', stiffness: 120, damping: 20 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
        >
          <span className="relative z-10">Begin</span>
        </motion.button>
      </div>

      {/* 底部信息 */}
      <motion.div
        className="text-on-media absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex w-full items-center justify-between px-7 text-[10px] tracking-wider md:text-xs"
        style={{ color: 'var(--fg-muted)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <span>{todayLabel}</span>
        <span>{streak > 0 ? `连续 ${streak} 天` : '今天开始'}</span>
      </motion.div>
    </motion.main>
  )
}
