import type { Reward } from '../store/types'

/** 按阈值升序排列的未领取奖励，即「下一个」目标 */
export function nextReward(rewards: Reward[]): Reward | null {
  const unclaimed = rewards.filter((r) => !r.claimed)
  if (unclaimed.length === 0) return null
  return unclaimed.reduce((a, b) => (a.threshold <= b.threshold ? a : b))
}

/** 下一个奖励的进度 0-1 */
export function rewardProgress(streak: number, reward: Reward | null): number {
  if (!reward || reward.threshold <= 0) return 1
  return Math.min(1, streak / reward.threshold)
}

/** 当前是否达成「下一个」奖励的领取条件 */
export function canClaim(streak: number, reward: Reward | null): boolean {
  return !!reward && streak >= reward.threshold
}

/** 已领取的奖励数量 */
export function claimedCount(rewards: Reward[]): number {
  return rewards.filter((r) => r.claimed).length
}
