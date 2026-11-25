import type { AppData, DayClose, Habit, Reward } from '../store/types'
import { SCHEMA_VERSION } from '../store/schema'

const EXPORT_KEY = 'intent-anchor'

export interface ExportBundle {
  app: string
  schemaVersion: number
  exportedAt: string
  data: AppData
}

/** 把当前数据打包成可下载的 JSON 字符串 */
export function exportData(data: AppData): string {
  const bundle: ExportBundle = {
    app: EXPORT_KEY,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
  return JSON.stringify(bundle, null, 2)
}

/** 导出文件名：带日期与分钟，避免同一天多次导出互相覆盖 */
export function backupFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
  return `intent-anchor-${stamp}.json`
}

/** 触发浏览器下载 */
export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 立即 revoke 会让部分浏览器取消下载，延后释放
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export type SaveResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * 保存备份文件。
 * iOS / 支持文件分享的浏览器优先调起系统分享面板（可直接「存储到文件」、发微信、存 iCloud）；
 * 其余环境回退为普通下载。
 */
export async function saveBackupFile(filename: string, content: string): Promise<SaveResult> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data?: ShareData) => Promise<void>
  }

  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    const file = new File([content], filename, { type: 'application/json' })
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Intent Anchor 备份' })
        return 'shared'
      } catch (e) {
        // 用户点了取消：不算失败，也不再回退下载（否则会突然弹下载，很困惑）
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
        // 其他异常（例如无权限）回退下载
      }
    }
  }

  downloadJson(filename, content)
  return 'downloaded'
}

export interface ImportBundle {
  data: AppData
  exportedAt: string | null
  schemaVersion: number
}

/**
 * 解析并校验导入的 JSON。
 * 覆盖式导入：先覆盖，后续版本再加"让用户选择合并"。
 * @throws 校验失败时抛出可读错误
 */
export function parseImport(text: string): ImportBundle {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('JSON 格式错误，无法解析')
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('文件内容不是有效对象')
  const bundle = parsed as Partial<ExportBundle>

  if (bundle.app !== EXPORT_KEY) throw new Error('这不是 Intent Anchor 的备份文件')
  if (typeof bundle.schemaVersion !== 'number') throw new Error('缺少数据版本号')
  if (bundle.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`备份版本(${bundle.schemaVersion})高于当前版本(${SCHEMA_VERSION})，请先升级应用`)
  }

  const data = bundle.data
  if (!data || typeof data !== 'object') throw new Error('备份文件缺少数据主体')

  return {
    data: normalizeAppData(data),
    exportedAt: typeof bundle.exportedAt === 'string' ? bundle.exportedAt : null,
    schemaVersion: bundle.schemaVersion,
  }
}

/**
 * 把任意来源的数据规范化为 AppData。
 * 逐字段校验，缺失/非法字段用默认值兜底——备份文件、旧版本 localStorage、
 * 崩溃救援都会走这里，保证进入 store 的数据结构一定可用（不合法就丢弃，而不是让页面崩）。
 */
export function normalizeAppData(input: unknown): AppData {
  const data = (isObject(input) ? input : {}) as Partial<AppData> & { intent?: unknown }
  const telemetry = isObject(data.telemetry) ? data.telemetry : undefined
  return {
    schemaVersion: SCHEMA_VERSION,
    // v1 的备份文件里没有 intents，只有一条 {date, text}；这里一并兼容读取
    intents: normalizeIntents(data.intents, data.intent),
    intentDone: normalizeIntentDone(data.intentDone),
    reviewSeen: normalizeTrueMap(data.reviewSeen),
    dayCloses: normalizeDayCloses(data.dayCloses),
    intentPresets: strArray(data.intentPresets) ?? DEFAULT_PRESETS,
    customPrompts: strArray(data.customPrompts) ?? [],
    habits: normalizeHabits(data.habits),
    checkins: normalizeCheckins(data.checkins),
    rewards: normalizeRewards(data.rewards),
    telemetry: {
      openCount: num(telemetry?.openCount),
      enterDurations: numArray(telemetry?.enterDurations) ?? [],
      lastOpenAt: typeof telemetry?.lastOpenAt === 'string' ? telemetry.lastOpenAt : undefined,
      checkinActions: num(telemetry?.checkinActions),
    },
  }
}

const DEFAULT_PRESETS = ['Deep work', 'Reading', 'Morning routine', 'Writing', 'Learning']

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}
function numArray(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : null
}
function isObject(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** 意图留档：优先读 v2 的 intents，读不到再兼容 v1 的单条 intent */
function normalizeIntents(v: unknown, legacy: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (isObject(v)) {
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) out[key] = val
    }
  }
  if (Object.keys(out).length === 0 && isObject(legacy)) {
    const l = legacy as { date?: unknown; text?: unknown }
    if (typeof l.date === 'string' && typeof l.text === 'string' && l.text.trim()) {
      out[l.date] = l.text
    }
  }
  return out
}

/** 今日专项完成记录：只认 true，其余一律丢弃 */
function normalizeIntentDone(v: unknown): Record<string, true> {
  return normalizeTrueMap(v)
}

/** 形如 Record<key, true> 的标记表：只认 true */
function normalizeTrueMap(v: unknown): Record<string, true> {
  const out: Record<string, true> = {}
  if (!isObject(v)) return out
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === true) out[key] = true
  }
  return out
}

/**
 * 每日收尾记录：date -> { note, at }。
 *
 * 只认结构完整的项：note 必须是字符串（允许空串——只盖章不留言是合法状态）。
 * at 缺失时用空串占位而不是丢弃整条：留言是用户写下的东西，比时间戳重要得多。
 */
function normalizeDayCloses(v: unknown): Record<string, DayClose> {
  const out: Record<string, DayClose> = {}
  if (!isObject(v)) return out
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    if (!isObject(val)) continue
    const d = val as Partial<DayClose>
    if (typeof d.note !== 'string') continue
    out[key] = {
      note: d.note.slice(0, 200),
      at: typeof d.at === 'string' ? d.at : '',
    }
  }
  return out
}

// ---- 结构规范化：损坏或旧版本的字段直接丢弃，避免导入后页面崩溃 ----

function normalizeHabits(v: unknown): Habit[] {
  if (!Array.isArray(v)) return []
  const out: Habit[] = []
  for (const item of v) {
    if (!isObject(item)) continue
    const h = item as Partial<Habit>
    if (typeof h.id !== 'string' || typeof h.name !== 'string') continue
    out.push({
      id: h.id,
      name: h.name,
      schedule: h.schedule === 'weekly' ? 'weekly' : 'daily',
      createdAt: typeof h.createdAt === 'string' ? h.createdAt : '',
      archived: h.archived === true,
      // 归档日期缺失 = 不知道哪天删的，交给 isHabitActiveOn 用「那天打过卡没有」兜底；
      // 不要在这里补今天，导入是「把别人的历史搬过来」，不能改写它
      archivedAt: typeof h.archivedAt === 'string' && h.archivedAt ? h.archivedAt : undefined,
    })
  }
  return out
}

function normalizeCheckins(v: unknown): Record<string, string[]> {
  if (!isObject(v)) return {}
  const out: Record<string, string[]> = {}
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    const arr = strArray(val)
    if (arr && arr.length) out[key] = arr
  }
  return out
}

function normalizeRewards(v: unknown): Reward[] {
  if (!Array.isArray(v)) return []
  const out: Reward[] = []
  for (const item of v) {
    if (!isObject(item)) continue
    const r = item as Partial<Reward>
    if (typeof r.id !== 'string' || typeof r.label !== 'string') continue
    if (typeof r.threshold !== 'number' || !Number.isFinite(r.threshold)) continue
    out.push({
      id: r.id,
      label: r.label,
      threshold: r.threshold,
      category: typeof r.category === 'string' ? r.category : '小奖励',
      claimed: r.claimed === true,
      unlockedAt: typeof r.unlockedAt === 'string' ? r.unlockedAt : undefined,
      mood: typeof r.mood === 'string' ? r.mood : undefined,
      satisfaction: typeof r.satisfaction === 'number' ? r.satisfaction : undefined,
      claimedAt: typeof r.claimedAt === 'string' ? r.claimedAt : undefined,
    })
  }
  return out
}
