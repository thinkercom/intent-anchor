import { create } from 'zustand'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { AppData } from '../store/types'
import { useAppStore } from '../store/useAppStore'

/** 备份元信息：只放"什么时候备份过"，不进业务数据，避免导出文件自我引用 */
const META_KEY = 'intent-anchor-backup-meta'

/** 超过这个天数且期间有新增记录，开始温和提醒 */
export const BACKUP_REMIND_DAYS = 7
/** 超过这个天数升级为强提醒 */
export const BACKUP_URGENT_DAYS = 14

export interface BackupMeta {
  lastExportAt: string | null
  lastImportAt: string | null
  /** 上次导出时已落盘的打卡条目总数，只用于界面上的「新增 N 条」文案 */
  lastExportCheckins: number
  /**
   * 上次导出时的数据指纹（v4 起）。
   *
   * 以前用「打卡条数有没有变多」判断要不要提醒，漏得太多：改意图、改习惯、
   * 改奖励、勾掉一次再打另一次（条数不变）、只写意图从不打卡，全都识别不到。
   * 指纹是内容级的：只要用户真正在意的那几类数据有一个字节不同，就提醒。
   */
  lastExportDigest: string | null
  exportCount: number
}

const EMPTY_META: BackupMeta = {
  lastExportAt: null,
  lastImportAt: null,
  lastExportCheckins: 0,
  lastExportDigest: null,
  exportCount: 0,
}

export function readBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return { ...EMPTY_META }
    const p = JSON.parse(raw) as Partial<BackupMeta>
    return {
      lastExportAt: typeof p.lastExportAt === 'string' ? p.lastExportAt : null,
      lastImportAt: typeof p.lastImportAt === 'string' ? p.lastImportAt : null,
      lastExportCheckins: typeof p.lastExportCheckins === 'number' ? p.lastExportCheckins : 0,
      lastExportDigest: typeof p.lastExportDigest === 'string' ? p.lastExportDigest : null,
      exportCount: typeof p.exportCount === 'number' ? p.exportCount : 0,
    }
  } catch {
    return { ...EMPTY_META }
  }
}

function writeBackupMeta(meta: BackupMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // 隐私模式下写入可能失败，静默处理：只是提醒不准，不影响数据本身
  }
  useBackupStore.setState({ meta })
}

/** 记录一次成功导出 */
export function markExported(source: DigestSource, checkinCount: number, at: Date = new Date()): void {
  const prev = readBackupMeta()
  writeBackupMeta({
    ...prev,
    lastExportAt: at.toISOString(),
    lastExportCheckins: checkinCount,
    lastExportDigest: dataDigest(source),
    exportCount: prev.exportCount + 1,
  })
}

/** 记录一次成功导入（导入后数据即已落盘在文件里，视为已备份） */
export function markImported(source: DigestSource, checkinCount: number, at: Date = new Date()): void {
  const prev = readBackupMeta()
  writeBackupMeta({
    ...prev,
    lastExportAt: at.toISOString(),
    lastImportAt: at.toISOString(),
    lastExportCheckins: checkinCount,
    lastExportDigest: dataDigest(source),
  })
}

/** 重置所有数据时把备份记录一起清掉，避免状态自相矛盾 */
export function resetBackupMeta(): void {
  writeBackupMeta({ ...EMPTY_META })
}

// ---- 概览：告诉用户"将导出什么" ----

export interface BackupSummary {
  habitCount: number
  /** 有打卡记录的天数 */
  dayCount: number
  /** 打卡条目总数（用来判断是否有新数据） */
  checkinCount: number
  firstDay: string | null
  lastDay: string | null
}

type SummarySource = Pick<
  AppData,
  'habits' | 'checkins' | 'intents' | 'intentDone' | 'intentPresets' | 'customPrompts' | 'rewards'
>

/** 指纹只看这几类：这些是用户真正会心疼的数据，改一个字节就值得重备一次 */
type DigestSource = SummarySource

export function summarizeData(data: SummarySource): BackupSummary {
  const days = Object.keys(data.checkins).sort()
  let checkinCount = 0
  for (const key of days) checkinCount += data.checkins[key]?.length ?? 0
  const recorded = days.filter((k) => (data.checkins[k]?.length ?? 0) > 0)
  // 只写意图、从没打过卡的用户也要有个起点，否则「从未备份」的判断永远等不到第一天
  const intentDays = Object.keys(data.intents ?? {}).sort()
  const allDays = [...recorded, ...intentDays].sort()
  return {
    habitCount: data.habits.filter((h) => !h.archived).length,
    dayCount: recorded.length,
    checkinCount,
    firstDay: allDays[0] ?? null,
    lastDay: allDays[allDays.length - 1] ?? null,
  }
}

/** 稳定序列化：对象按键名排序，数组保持顺序（打卡 id 会先排好） */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(',')}}`
}

/**
 * 数据指纹（FNV-1a 32 位）。
 *
 * 为什么不用「打卡条数」：条数只在「新增打卡」时变化。
 * 改意图、改习惯名、改奖励、勾掉一次再打另一次（条数一样）都识别不到，
 * 于是用户改了东西却一直显示「已备份」，反而更危险。
 *
 * 刻意排除 telemetry（每次打开都变）和 reviewSeen（看过回顾就变）：
 * 这两个字段一变就提醒，等于天天催备份，提醒本身会失去意义。
 */
export function dataDigest(source: DigestSource): string {
  const checkins: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(source.checkins ?? {})) {
    // 同一天先取消再打卡会改变数组顺序，内容其实没变——排序后再算，
    // 避免为一次「手滑又点回来」提醒备份
    checkins[key] = [...(ids ?? [])].sort()
  }
  const payload = stable({
    habits: source.habits,
    checkins,
    intents: source.intents,
    intentDone: source.intentDone,
    intentPresets: source.intentPresets,
    customPrompts: source.customPrompts,
    rewards: source.rewards,
  })
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

// ---- 备份状态 ----

export type BackupLevel = 'empty' | 'ok' | 'due' | 'overdue'

export interface BackupStatus {
  level: BackupLevel
  /** 需要用户在设置页/入口上看到提醒 */
  needsAttention: boolean
  lastExportAt: string | null
  lastImportAt: string | null
  /** 距上次备份的整天数；从未备份为 null */
  daysSince: number | null
  /** 上次备份之后数据是否有改动（内容级，不只是条数） */
  hasChanges: boolean
  /** 上次备份之后新增、尚未备份的打卡条目数（仅用于文案） */
  unbackedCheckins: number
  /** 历史累计导出次数 */
  exportCount: number
  summary: BackupSummary
}

function daysSinceKey(key: string): number {
  const d = parseISO(key)
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, differenceInCalendarDays(new Date(), d))
}

function computeStatus(source: SummarySource, meta: BackupMeta): BackupStatus {
  const summary = summarizeData(source)
  const hasData =
    summary.checkinCount > 0 ||
    Object.keys(source.intents ?? {}).length > 0 ||
    source.customPrompts.length > 0

  const daysSince = meta.lastExportAt ? daysSinceKey(meta.lastExportAt) : null
  const unbackedCheckins = Math.max(0, summary.checkinCount - meta.lastExportCheckins)
  // 指纹是新口径；老版本的元信息没有指纹，退回条数比较（升级后的第一次导出会补上）
  const hasChanges = meta.lastExportDigest
    ? meta.lastExportDigest !== dataDigest(source)
    : summary.checkinCount > meta.lastExportCheckins

  const base = {
    lastExportAt: meta.lastExportAt,
    lastImportAt: meta.lastImportAt,
    daysSince,
    hasChanges,
    unbackedCheckins,
    exportCount: meta.exportCount,
    summary,
  }

  // 还没产生任何记录：不打扰
  if (!hasData) {
    return { ...base, level: 'empty', needsAttention: false }
  }

  // 有记录但从未备份：第一天不打扰，第二天起提示
  if (!meta.lastExportAt) {
    const age = summary.firstDay ? daysSinceKey(summary.firstDay) : 0
    const level: BackupLevel = age >= 1 ? 'due' : 'ok'
    return { ...base, level, needsAttention: level === 'due' }
  }

  // 数据没有变化：不提醒
  if (!hasChanges) {
    return { ...base, level: 'ok', needsAttention: false }
  }

  const d = daysSince ?? 0
  if (d >= BACKUP_URGENT_DAYS) return { ...base, level: 'overdue', needsAttention: true }
  if (d >= BACKUP_REMIND_DAYS) return { ...base, level: 'due', needsAttention: true }
  return { ...base, level: 'ok', needsAttention: false }
}

/** 备份元信息的全局小 store：导出/导入后各页面（红点、提示条）同步更新 */
export const useBackupStore = create<{ meta: BackupMeta; refresh: () => void }>((set) => ({
  meta: readBackupMeta(),
  refresh: () => set({ meta: readBackupMeta() }),
}))

/** 订阅数据 + 备份元信息，得到当前备份状态 */
export function useBackupStatus(): BackupStatus {
  const meta = useBackupStore((s) => s.meta)
  const habits = useAppStore((s) => s.habits)
  const checkins = useAppStore((s) => s.checkins)
  const intents = useAppStore((s) => s.intents)
  const intentDone = useAppStore((s) => s.intentDone)
  const intentPresets = useAppStore((s) => s.intentPresets)
  const customPrompts = useAppStore((s) => s.customPrompts)
  const rewards = useAppStore((s) => s.rewards)

  return computeStatus(
    { habits, checkins, intents, intentDone, intentPresets, customPrompts, rewards },
    meta,
  )
}

/** 状态文案（设置页 / 提示条共用） */
export function backupStatusText(status: BackupStatus): string {
  if (status.level === 'empty') return '还没有记录，暂时不用备份'
  if (!status.lastExportAt) return '还没有导出过备份'
  const d = status.daysSince ?? 0
  if (d === 0) return status.hasChanges ? '今天备份过 · 之后有改动' : '今天备份过'
  return `${d} 天前备份`
}
