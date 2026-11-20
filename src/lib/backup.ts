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
  /** 上次导出时已落盘的打卡条目总数，用来判断"之后有没有新数据没备份" */
  lastExportCheckins: number
  exportCount: number
}

const EMPTY_META: BackupMeta = {
  lastExportAt: null,
  lastImportAt: null,
  lastExportCheckins: 0,
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
export function markExported(checkinCount: number, at: Date = new Date()): void {
  const prev = readBackupMeta()
  writeBackupMeta({
    ...prev,
    lastExportAt: at.toISOString(),
    lastExportCheckins: checkinCount,
    exportCount: prev.exportCount + 1,
  })
}

/** 记录一次成功导入（导入后数据即已落盘在文件里，视为已备份） */
export function markImported(checkinCount: number, at: Date = new Date()): void {
  const prev = readBackupMeta()
  writeBackupMeta({
    ...prev,
    lastExportAt: at.toISOString(),
    lastImportAt: at.toISOString(),
    lastExportCheckins: checkinCount,
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

type SummarySource = Pick<AppData, 'habits' | 'checkins' | 'intent' | 'customPrompts' | 'rewards'>

export function summarizeData(data: SummarySource): BackupSummary {
  const days = Object.keys(data.checkins).sort()
  let checkinCount = 0
  for (const key of days) checkinCount += data.checkins[key]?.length ?? 0
  const recorded = days.filter((k) => (data.checkins[k]?.length ?? 0) > 0)
  return {
    habitCount: data.habits.filter((h) => !h.archived).length,
    dayCount: recorded.length,
    checkinCount,
    firstDay: recorded[0] ?? null,
    lastDay: recorded[recorded.length - 1] ?? null,
  }
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
  /** 上次备份之后新增、尚未备份的打卡条目数 */
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
    summary.checkinCount > 0 || !!source.intent?.text || source.customPrompts.length > 0

  const daysSince = meta.lastExportAt ? daysSinceKey(meta.lastExportAt) : null
  const unbackedCheckins = Math.max(0, summary.checkinCount - meta.lastExportCheckins)

  const base = {
    lastExportAt: meta.lastExportAt,
    lastImportAt: meta.lastImportAt,
    daysSince,
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

  // 数据没有变化（上次导出时的记录数 >= 现在）：不提醒
  if (unbackedCheckins === 0) {
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
  const intent = useAppStore((s) => s.intent)
  const customPrompts = useAppStore((s) => s.customPrompts)
  const rewards = useAppStore((s) => s.rewards)

  return computeStatus({ habits, checkins, intent, customPrompts, rewards }, meta)
}

/** 状态文案（设置页 / 提示条共用） */
export function backupStatusText(status: BackupStatus): string {
  if (status.level === 'empty') return '还没有记录，暂时不用备份'
  if (!status.lastExportAt) return '还没有导出过备份'
  const d = status.daysSince ?? 0
  if (d === 0) return status.unbackedCheckins > 0 ? '今天备份过 · 之后有新增记录' : '今天备份过'
  return `${d} 天前备份`
}
