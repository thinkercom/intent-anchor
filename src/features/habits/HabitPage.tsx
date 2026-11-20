import { motion } from 'motion/react'
import { ArrowLeft, Settings2, Flame } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { getLogicalDateKey, computeStreak, todayProgress } from '../../lib/date'
import { nextReward, claimedCount } from '../../lib/rewards'
import { HabitItem } from './HabitItem'
import { IntentEditor } from './IntentEditor'
import { RewardMilestone } from './RewardMilestone'

interface Props {
  onBack: () => void
  onOpenSettings: () => void
}

export function HabitPage({ onBack, onOpenSettings }: Props) {
  const intent = useAppStore((s) => s.intent)
  const intentPresets = useAppStore((s) => s.intentPresets)
  const habits = useAppStore((s) => s.habits)
  const checkins = useAppStore((s) => s.checkins)
  const rewards = useAppStore((s) => s.rewards)
  const setIntent = useAppStore((s) => s.setIntent)
  const addIntentPreset = useAppStore((s) => s.addIntentPreset)
  const toggleCheckin = useAppStore((s) => s.toggleCheckin)
  const claimReward = useAppStore((s) => s.claimReward)

  const todayKey = getLogicalDateKey()
  const activeHabits = habits.filter((h) => !h.archived)
  const activeIds = activeHabits.map((h) => h.id)
  const streak = computeStreak(checkins, activeIds, todayKey)
  const progress = todayProgress(checkins, activeIds, todayKey)
  const doneCount = (checkins[todayKey] ?? []).filter((id) => activeIds.includes(id)).length
  const reward = nextReward(rewards)

  // 意图：当天有效才显示，否则沿用昨天（空则提示设定）
  const intentText =
    intent && intent.text
      ? intent.date === todayKey
        ? intent.text
        : `${intent.text}（昨日）`
      : ''

  return (
    <motion.main
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: 'var(--bg)' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4 }}
    >
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-2 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <motion.button onClick={onBack} className="rounded-full p-2" style={{ color: 'var(--fg-muted)' }} whileTap={{ scale: 0.92 }} aria-label="返回">
          <ArrowLeft size={20} />
        </motion.button>
        <span className="text-sm tracking-[0.2em]" style={{ color: 'var(--fg)' }}>习惯养成</span>
        <motion.button onClick={onOpenSettings} className="rounded-full p-2" style={{ color: 'var(--fg-muted)' }} whileTap={{ scale: 0.92 }} aria-label="设置">
          <Settings2 size={19} />
        </motion.button>
      </div>

      {/* 可滚动内容 */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* 连续天数 + 完成度 */}
        <motion.div
          className="mb-5 flex items-end justify-between rounded-2xl px-5 py-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="flex items-center gap-1.5 text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>
              <Flame size={14} />
              连续专注
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl" style={{ fontFamily: 'var(--headline-font)', color: 'var(--fg)' }}>{streak}</span>
              <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>天</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] tracking-wider" style={{ color: 'var(--fg-muted)' }}>今日完成</span>
            <div className="mt-1 text-lg" style={{ color: 'var(--fg)' }}>
              {doneCount} / {activeHabits.length}
            </div>
            <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full" style={{ background: 'var(--glass)' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'var(--accent)' }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>
        </motion.div>

        {/* 意图设定 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <IntentEditor
            current={intentText}
            presets={intentPresets}
            onSet={setIntent}
            onAddPreset={addIntentPreset}
          />
        </motion.div>

        {/* 习惯列表 */}
        <div className="mb-3 mt-6 flex items-center justify-between px-1">
          <span className="text-xs tracking-wider" style={{ color: 'var(--fg-muted)' }}>今日习惯 · 轻触打卡</span>
          <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{Math.round(progress * 100)}%</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {activeHabits.map((habit, i) => (
            <HabitItem
              key={habit.id}
              habit={habit}
              checked={(checkins[todayKey] ?? []).includes(habit.id)}
              onToggle={() => toggleCheckin(habit.id)}
              index={i}
            />
          ))}
          {activeHabits.length === 0 && (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>还没有习惯，去设置里添加吧</p>
          )}
        </div>

        {/* 奖励里程碑 */}
        <RewardMilestone
          streak={streak}
          reward={reward}
          claimedTotal={claimedCount(rewards)}
          onClaim={claimReward}
        />
      </div>
    </motion.main>
  )
}
