import type { AppData } from '../store/types'

export const SCHEMA_VERSION = 1
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
  URL.revokeObjectURL(url)
}

/**
 * 解析并校验导入的 JSON。
 * 覆盖式导入：先覆盖，后续版本再加"让用户选择合并"。
 * @throws 校验失败时抛出可读错误
 */
export function parseImport(text: string): AppData {
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

  // 逐字段做基本校验，缺失字段用默认值兜底（向后兼容低版本）
  const result: AppData = {
    schemaVersion: SCHEMA_VERSION,
    intent: isValidIntent(data.intent) ? data.intent : null,
    intentPresets: strArray(data.intentPresets) ?? DEFAULT_PRESETS,
    customPrompts: strArray(data.customPrompts) ?? [],
    habits: Array.isArray(data.habits) ? data.habits : [],
    checkins: isObject(data.checkins) ? (data.checkins as AppData['checkins']) : {},
    rewards: Array.isArray(data.rewards) ? data.rewards : [],
    telemetry: {
      openCount: num(data.telemetry?.openCount),
      enterDurations: numArray(data.telemetry?.enterDurations) ?? [],
      lastOpenAt: data.telemetry?.lastOpenAt,
      checkinActions: num(data.telemetry?.checkinActions),
    },
  }
  return result
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
function isValidIntent(v: unknown): v is AppData['intent'] {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as { text?: unknown }).text === 'string' &&
    typeof (v as { date?: unknown }).date === 'string'
  )
}
