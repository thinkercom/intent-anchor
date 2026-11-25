import { motion } from 'motion/react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAppStore } from '../../store/useAppStore'
import { computeStreak, dayStats, prevDateKey } from '../../lib/date'
import { hasDayActivity } from '../../lib/stats'
import { useLogicalToday } from '../../lib/useLogicalToday'
import { HEADLINE_LINES, promptForDate } from '../../lib/prompts'
import type { Theme, ThemeMode } from '../../lib/useTheme'
import type { ViewName } from '../../store/types'
import { FlowerHeadline } from './FlowerHeadline'
import { PixelThemeToggle } from './PixelThemeToggle'
import { BeginButton } from './BeginButton'

interface Props {
  onBegin: () => void
  onOpenClosing: () => void
  theme: Theme
  themeMode: ThemeMode
  onToggleTheme: () => void
  onResetTheme: () => void
}

export function CoverPage({
  onBegin,
  onOpenClosing,
  theme,
  themeMode,
  onToggleTheme,
  onResetTheme,
}: Props) {
  const customPrompts = useAppStore((s) => s.customPrompts)
  const checkins = useAppStore((s) => s.checkins)
  const habits = useAppStore((s) => s.habits)
  const intents = useAppStore((s) => s.intents)
  const intentDone = useAppStore((s) => s.intentDone)
  const dayCloses = useAppStore((s) => s.dayCloses)
  const setView = useAppStore((s) => s.setView)

  const todayKey = useLogicalToday()
  const prompt = promptForDate(todayKey, customPrompts)
  const activeIds = habits.filter((h) => !h.archived).map((h) => h.id)
  const streak = computeStreak(checkins, habits, todayKey)
  const todayLabel = format(new Date(), 'M月d日 EEEE', { locale: zhCN })

  // 打断回归：当天已设意图但未全部完成时，显示「你刚才要做的是 X」
  const doneToday = checkins[todayKey] ?? []
  const todayIntent = intents[todayKey] ?? ''
  const intentPending =
    !!todayIntent && activeIds.length > 0 && !activeIds.every((id) => doneToday.includes(id))
  const todayIntentDone = !!intentDone[todayKey]

  // 昨天做到多少：把「积累」带到今天来。
  // 只在昨天确实有打卡时显示 —— 昨天 0/5 只会平白让人泄气。
  const yesterday = dayStats(checkins, habits, prevDateKey(todayKey))
  const showYesterday = yesterday.done > 0

  // 收尾：今天动过才给入口，动过之后也可以把这一天合上。
  // 已收尾则不再显示入口，只留一行状态 —— 同一天重复问「要结束今天吗」是催。
  const closedToday = !!dayCloses[todayKey]
  const canClose = !closedToday && hasDayActivity(checkins, todayKey, intentDone)

  // 收尾之后显示「自己刚写的那句」，而不是昨天那句：
  // 刚写完就把页面上的话换回旧的，会让人以为没存上。
  // 没写过就继续显示昨天留下的 —— 它才是这一天真正的开头。
  const carriedNote = closedToday
    ? (dayCloses[todayKey]?.note?.trim() ?? '')
    : (dayCloses[prevDateKey(todayKey)]?.note?.trim() ?? '')

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
            {todayIntentDone ? '已完成' : intentPending ? '你刚才要做的是' : '今日意图'}「
            {todayIntent}」{todayIntentDone ? '' : ' →'}
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

        {/* 中心按钮：立体键帽。入场动画放在外层容器上 ——
            按钮自己的 transform 是「旋转 + 斜切」，被 scale 覆盖就会被摆正 */}
        <motion.div
          className="mt-9"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26, duration: 0.55, type: 'spring', stiffness: 120, damping: 20 }}
        >
          <BeginButton onClick={onBegin} />
        </motion.div>

        {/* 收尾：与 Begin 共用一条竖轴、同一个位置，一天有开就有关。
            刻意做成 11px 无边框文字 —— 它是旁白，不是第二个按钮。
            已收尾时同一位置换成状态，让「今天合上了」这件事留在页面上。 */}
        <motion.div
          className="mt-5 h-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.34, duration: 0.5 }}
        >
          {closedToday || canClose ? (
            <motion.button
              onClick={onOpenClosing}
              className="text-on-media text-[11px] tracking-wider"
              style={{ color: 'var(--fg-muted)', opacity: closedToday ? 0.7 : 1 }}
              whileTap={{ scale: 0.96 }}
            >
              {closedToday ? '今天已收尾' : '今天到此为止'}
            </motion.button>
          ) : null}
        </motion.div>
      </div>

      {/* 底部信息 */}
      <motion.div
        className="text-on-media absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex w-full flex-col items-center gap-2.5 px-7"
        style={{ color: 'var(--fg-muted)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {/* 昨天收尾时留给今天的那句话。
            没有这一行，收尾输入框就是写进黑洞——用户不会第二次打开它。 */}
        {carriedNote && (
          <p
            className="line-clamp-2 max-w-[19rem] text-balance text-center text-[11px] leading-relaxed md:text-[12px]"
            style={{ color: 'var(--fg)', opacity: 0.62 }}
            title={carriedNote}
          >
            「{carriedNote}」
          </p>
        )}
        <div className="flex w-full items-center justify-between text-[10px] tracking-wider md:text-xs">
          <span>{todayLabel}</span>
          <span className="flex items-center gap-1.5">
            {showYesterday && (
              <>
                <span>昨天 {yesterday.done}/{yesterday.total}</span>
                {streak > 0 && <span style={{ opacity: 0.35 }}>·</span>}
              </>
            )}
            {/* 「今天开始」只在真的一点记录都没有时才说。
                昨天做过 3/4 却写着「今天开始」，读起来是自相矛盾的 */}
            {streak > 0 ? (
              <span>连续 {streak} 天</span>
            ) : (
              !showYesterday && <span>今天开始</span>
            )}
          </span>
        </div>
      </motion.div>
    </motion.main>
  )
}
