import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Gift, Sparkles, X } from 'lucide-react'
import type { Reward } from '../../store/types'
import { rewardProgress, canClaim } from '../../lib/rewards'

interface Props {
  streak: number
  reward: Reward | null
  claimedTotal: number
  onClaim: (rewardId: string, mood?: string, satisfaction?: number) => void
}

const MOODS = ['开心', '满足', '一般', '失望']

export function RewardMilestone({ streak, reward, claimedTotal, onClaim }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [mood, setMood] = useState<string>()
  const [satisfaction, setSatisfaction] = useState(4)

  if (!reward) {
    return (
      <div
        className="surface mt-6 rounded-2xl px-5 py-4 text-center text-sm"
        style={{ color: 'var(--fg-muted)' }}
      >
        奖励都兑现完了 🎉 去设置里加个新目标吧
      </div>
    )
  }

  const progress = rewardProgress(streak, reward)
  const claimable = canClaim(streak, reward)
  // 已解锁但当前连续天数掉下来了：资格还在，只是不再喊「你刚达成」
  const unlockedBefore = !!reward.unlockedAt && streak < reward.threshold

  const handleClaimClick = () => {
    if (!claimable) return
    setMood(undefined)
    setSatisfaction(4)
    setShowModal(true)
  }

  const confirmClaim = () => {
    onClaim(reward.id, mood, satisfaction)
    setShowModal(false)
  }

  return (
    <>
      <div className="surface mt-6 rounded-2xl px-5 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs tracking-wider" style={{ color: 'var(--fg-muted)' }}>
          <Gift size={14} />
          <span>下一个奖励 · 已兑现 {claimedTotal} 个</span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-base" style={{ color: 'var(--fg)' }}>
            {reward.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            {unlockedBefore ? '已达成 · 待兑现' : `${streak} / ${reward.threshold} 天`}
          </span>
        </div>

        {/* 进度条 */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass)' }}>
          <motion.div
            className="liquid-bar h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* 可领取时的强调按钮 */}
        <AnimatePresence>
          {claimable && (
            <motion.button
              onClick={handleClaimClick}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles size={15} />
              我已兑现 · 领取奖励
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 领取反馈弹层：记录心情与满意度，喂给未来的推荐 Agent */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'var(--veil)' }} onClick={() => setShowModal(false)} />
            <motion.div
              className="surface surface-hero relative z-10 w-full max-w-xs rounded-3xl p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--fg)' }}>🎉 兑现「{reward.label}」</span>
                <button onClick={() => setShowModal(false)} style={{ color: 'var(--fg-muted)' }} aria-label="关闭">
                  <X size={18} />
                </button>
              </div>
              <p className="mb-2 text-xs" style={{ color: 'var(--fg-muted)' }}>现在心情如何？</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className="rounded-full px-3 py-1.5 text-xs"
                    style={{
                      background: mood === m ? 'var(--accent)' : 'var(--glass)',
                      color: mood === m ? 'var(--bg)' : 'var(--fg)',
                      border: '1px solid var(--card-border)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-xs" style={{ color: 'var(--fg-muted)' }}>满意度：{satisfaction} / 5</p>
              <input
                type="range"
                min={1}
                max={5}
                value={satisfaction}
                onChange={(e) => setSatisfaction(Number(e.target.value))}
                className="mb-5 w-full"
                style={{ accentColor: 'var(--accent)' }}
              />
              <button
                onClick={confirmClaim}
                className="w-full rounded-xl py-2.5 text-sm"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                确认领取
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
