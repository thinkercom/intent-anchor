import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, Reorder, motion } from 'motion/react'
import { ArrowLeft, Settings2, Flame, Plus, Sparkles, CalendarDays } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { computeStreak, todayProgress } from '../../lib/date'
import { weekSummary } from '../../lib/stats'
import { useLogicalToday } from '../../lib/useLogicalToday'
import { nextReward, claimedCount } from '../../lib/rewards'
import { useBackupStatus } from '../../lib/backup'
import { HabitItem } from './HabitItem'
import { IntentEditor } from './IntentEditor'
import { RewardMilestone } from './RewardMilestone'
import { UndoToast } from './UndoToast'
import { FirstRunGuide } from './FirstRunGuide'
import { WeeklyReview } from './WeeklyReview'
import type { Habit } from '../../store/types'
import type { UndoInfo } from './UndoToast'

interface Props {
  onBack: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
}

export function HabitPage({ onBack, onOpenSettings, onOpenHistory }: Props) {
  const intents = useAppStore((s) => s.intents)
  const intentDone = useAppStore((s) => s.intentDone)
  const reviewSeen = useAppStore((s) => s.reviewSeen)
  const dismissReview = useAppStore((s) => s.dismissReview)
  const intentPresets = useAppStore((s) => s.intentPresets)
  const habits = useAppStore((s) => s.habits)
  const checkins = useAppStore((s) => s.checkins)
  const rewards = useAppStore((s) => s.rewards)
  const setIntent = useAppStore((s) => s.setIntent)
  const toggleIntentDone = useAppStore((s) => s.toggleIntentDone)
  const addIntentPreset = useAppStore((s) => s.addIntentPreset)
  const setCheckin = useAppStore((s) => s.setCheckin)
  const setHabitOrder = useAppStore((s) => s.setHabitOrder)
  const claimReward = useAppStore((s) => s.claimReward)
  const markRewardUnlocked = useAppStore((s) => s.markRewardUnlocked)
  const backup = useBackupStatus()

  // 跨过 04:00 会自动换天（页面挂在后台再回来也一样）
  const todayKey = useLogicalToday()
  const activeHabits = habits.filter((h) => !h.archived)
  const activeIds = activeHabits.map((h) => h.id)
  const streak = computeStreak(checkins, habits, todayKey)
  const progress = todayProgress(checkins, activeIds, todayKey)
  const doneCount = (checkins[todayKey] ?? []).filter((id) => activeIds.includes(id)).length
  const reward = nextReward(rewards)

  // 上周回顾：只在「上周真动过」且「这一周还没看过」时出现。
  // 上周一片空白时不弹——那种时候给一段总结只会像指责。
  const week = weekSummary(checkins, habits, todayKey)
  const showReview = week.done > 0 && week.total > 0 && !reviewSeen[week.weekStart]

  // 今日意图：v2 起按日期留档，今天没设就是空的（昨天的去历史页看，
  // 不再像 v1 那样把「（昨日）」硬挂在今天下面，容易让人以为今天已经设过了）
  const intentText = intents[todayKey] ?? ''
  const focusDone = !!intentDone[todayKey]

  // ---- 打卡撤销 ----
  const [undo, setUndo] = useState<UndoInfo | null>(null)
  const undoTimerRef = useRef<number | null>(null)

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

  const handleToggle = (habit: Habit) => {
    const wasChecked = (checkins[todayKey] ?? []).includes(habit.id)
    setCheckin(habit.id, !wasChecked, todayKey)
    setUndo({ id: habit.id, name: habit.name, wasChecked, dateKey: todayKey })
    clearUndoTimer()
    undoTimerRef.current = window.setTimeout(() => setUndo(null), 5200)
  }

  const handleUndo = () => {
    if (!undo) return
    // 幂等写回：中途如果又点了别的习惯，也不会把状态搞乱
    setCheckin(undo.id, undo.wasChecked, undo.dateKey)
    setUndo(null)
    clearUndoTimer()
  }

  useEffect(() => clearUndoTimer, [])

  // ---- 跨天提示 ----
  const prevDayRef = useRef(todayKey)
  const [rolled, setRolled] = useState(false)
  useEffect(() => {
    if (prevDayRef.current === todayKey) return
    prevDayRef.current = todayKey
    setUndo(null)
    setRolled(true)
    const t = window.setTimeout(() => setRolled(false), 6000)
    return () => window.clearTimeout(t)
  }, [todayKey])

  // ---- 奖励解锁：达成即记录，之后即使断掉也还能兑现 ----
  useEffect(() => {
    for (const r of rewards) {
      if (!r.claimed && !r.unlockedAt && streak >= r.threshold) markRewardUnlocked(r.id)
    }
  }, [rewards, streak, markRewardUnlocked])

  const handleReorder = (next: Habit[]) => setHabitOrder(next.map((h) => h.id))

  const checkedToday = checkins[todayKey] ?? []
  // 引导卡：刚打卡就消失会让人来不及看，留到有 3 天记录后再自动收起
  const daysRecorded = Object.keys(checkins).length

  return (
    <motion.main
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: 'var(--page-bg)' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4 }}
    >
      {/* 顶栏：标题绝对居中，右侧可以随时加图标而不会把标题推歪 */}
      <div className="relative flex items-center justify-between px-2 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <motion.button onClick={onBack} className="rounded-full p-2" style={{ color: 'var(--fg-muted)' }} whileTap={{ scale: 0.92 }} aria-label="返回">
          <ArrowLeft size={20} />
        </motion.button>
        <span
          className="absolute left-1/2 -translate-x-1/2 text-sm tracking-[0.2em]"
          style={{ color: 'var(--fg)' }}
        >
          习惯养成
        </span>
        <div className="flex items-center">
          <motion.button
            onClick={onOpenHistory}
            className="rounded-full p-2"
            style={{ color: 'var(--fg-muted)' }}
            whileTap={{ scale: 0.92 }}
            aria-label="查看历史记录"
          >
            <CalendarDays size={19} />
          </motion.button>
          <motion.button
            onClick={onOpenSettings}
            className="relative rounded-full p-2"
            style={{ color: 'var(--fg-muted)' }}
            whileTap={{ scale: 0.92 }}
            aria-label={backup.needsAttention ? '设置（有数据备份提醒）' : '设置'}
          >
            <Settings2 size={19} />
            {backup.needsAttention && (
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--warn-fg)' }}
              />
            )}
          </motion.button>
        </div>
      </div>

      {/* 可滚动内容 */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* 连续天数 + 完成度：这一屏的主角，给最大的光和最远的投影，
            与下面的习惯列表拉开层次，而不是所有卡片一样重 */}
        <motion.div
          className="surface surface-hero relative mb-6 flex items-end justify-between rounded-[26px] px-6 py-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* 两栏之间的细光，把「连续」和「今日」分开，而不是靠留白硬撑 */}
          <span
            className="absolute left-1/2 top-5 bottom-5 w-px -translate-x-1/2"
            style={{ background: 'linear-gradient(180deg, transparent, var(--card-border), transparent)' }}
            aria-hidden="true"
          />
          <div>
            <span className="flex items-center gap-1.5 text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
              <Flame size={14} />
              连续专注
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[3rem] leading-none tracking-tight" style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}>{streak}</span>
              <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>天</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>今日完成</span>
            <div className="mt-2 text-lg" style={{ color: 'var(--fg)' }}>
              {doneCount} / {activeHabits.length}
            </div>
            <div className="mt-2 h-1 w-24 overflow-hidden rounded-full" style={{ background: 'var(--glass)' }}>
              <motion.div
                className="liquid-bar h-full rounded-full"
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </motion.div>

        {/* 上周回顾：放在主卡下面。它是「看一眼就走」的内容，不该挡在打卡前面 */}
        <AnimatePresence initial={false}>
          {showReview && (
            <WeeklyReview
              key={week.weekStart}
              summary={week}
              onDismiss={() => dismissReview(week.weekStart)}
            />
          )}
        </AnimatePresence>

        {/* 跨天提示：让人知道「今天」已经换了，不是数据丢了 */}
        <AnimatePresence>
          {rolled && (
            <motion.div
              className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]"
              style={{ background: 'var(--glass)', border: '1px solid var(--card-border)', color: 'var(--fg-muted)' }}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            >
              <Sparkles size={13} className="shrink-0" />
              新的一天已开始（凌晨 4 点换日），今日完成已重置
            </motion.div>
          )}
        </AnimatePresence>

        {/* 意图设定 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <IntentEditor
            current={intentText}
            done={focusDone}
            presets={intentPresets}
            onSet={setIntent}
            onToggleDone={() => toggleIntentDone(todayKey)}
            onAddPreset={addIntentPreset}
          />
        </motion.div>

        {/* 首次使用引导：只在该看到的时候出现一次 */}
        <FirstRunGuide visible={daysRecorded < 3 && activeHabits.length > 0} />

        {/* 习惯列表 */}
        <div className="mb-3 mt-6 flex items-center justify-between px-1">
          <span className="text-xs tracking-wider" style={{ color: 'var(--fg-muted)' }}>
            今日习惯 · 轻触打卡 · 长按排序
          </span>
          <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{Math.round(progress * 100)}%</span>
        </div>

        {activeHabits.length > 0 ? (
          <Reorder.Group
            as="div"
            axis="y"
            values={activeHabits}
            onReorder={handleReorder}
            className="flex flex-col gap-2.5"
          >
            {activeHabits.map((habit, i) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                checked={checkedToday.includes(habit.id)}
                onToggle={() => handleToggle(habit)}
                index={i}
              />
            ))}
          </Reorder.Group>
        ) : (
          <div
            className="surface rounded-2xl px-5 py-6 text-center"
          >
            <p className="text-sm" style={{ color: 'var(--fg)' }}>还没有习惯</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              建议先加 3–5 个每天都能做到的小事，比一个大目标更容易坚持。
            </p>
            <button
              onClick={onOpenSettings}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <Plus size={15} />去添加习惯
            </button>
          </div>
        )}

        {/* 奖励里程碑 */}
        <RewardMilestone
          streak={streak}
          reward={reward}
          claimedTotal={claimedCount(rewards)}
          onClaim={claimReward}
        />
      </div>

      {/* 打卡撤销：误触不用去设置里找开关 */}
      <UndoToast info={undo} onUndo={handleUndo} onDismiss={() => setUndo(null)} />
    </motion.main>
  )
}
