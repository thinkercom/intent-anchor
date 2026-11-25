import type { ErrorInfo } from 'react'
import {
  exportData,
  backupFilename,
  normalizeAppData,
  saveBackupFile,
  type SaveResult,
} from './exportImport'
import { markExported, summarizeData } from './backup'
import { STORE_KEY } from '../store/schema'

/**
 * 崩溃救援：全部操作只依赖 localStorage 原始字符串，
 * 不经过 Zustand store —— 因为白屏往往就是 store 里的数据把渲染搞崩了。
 */

const CRASH_KEY = 'intent-anchor-crashes'
const MAX_CRASHES = 5

// ---- 读取 / 修复 ----

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORE_KEY)
  } catch {
    return null
  }
}

/** 从 zustand persist 的包装里取出业务数据（兼容没有包裹的裸对象） */
function extractState(raw: string | null): unknown {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { state?: unknown } | unknown
    if (parsed && typeof parsed === 'object' && 'state' in parsed) {
      return (parsed as { state?: unknown }).state
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * 本机是否存有数据（用于崩溃页决定文案）。
 * 故意不要求能规范化成功：数据坏掉时更要说「数据还在」。
 */
export function hasLocalData(): boolean {
  const state = extractState(readRaw()) as Record<string, unknown> | null
  if (!state || typeof state !== 'object') return false
  const habits = Array.isArray(state.habits) ? state.habits.length : 0
  const checkins =
    state.checkins && typeof state.checkins === 'object'
      ? Object.keys(state.checkins as Record<string, unknown>).length
      : 0
  return habits > 0 || checkins > 0
}

/**
 * 归档当前存储数据（不管能不能解析，都先复制一份原始字符串）。
 * 修复/清空前调用，给用户留一条后路。
 */
export function snapshotCorruptedData(): boolean {
  const raw = readRaw()
  if (!raw) return false
  try {
    // 只保留最近一份损坏快照：反复点「修复」不该把存储撑爆
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${STORE_KEY}-broken-`)) stale.push(key)
    }
    stale.forEach((k) => localStorage.removeItem(k))
    localStorage.setItem(`${STORE_KEY}-broken-${Date.now()}`, raw)
    return true
  } catch {
    return false
  }
}

export interface RepairResult {
  ok: boolean
  message: string
}

/**
 * 尽力修复：把存储里的数据按当前 schema 规范化后写回。
 * 能保留的习惯/打卡会保留，非法字段被丢弃。
 */
export function repairStoredData(): RepairResult {
  const raw = readRaw()
  if (!raw) return { ok: false, message: '本机没有找到数据' }
  try {
    JSON.parse(raw)
  } catch {
    return { ok: false, message: '数据文件已损坏，无法解析' }
  }
  const data = normalizeAppData(extractState(raw))
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ state: data, version: data.schemaVersion }))
    return { ok: true, message: '数据已修复' }
  } catch {
    return { ok: false, message: '写入失败（存储空间可能已满）' }
  }
}

/** 清空业务数据（保留主题等偏好） */
export function clearStoredData(): void {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // 忽略：清理失败也不该阻塞页面重新加载
  }
}

// ---- 救援导出 ----

/**
 * 崩溃时导出数据：直接从 localStorage 取，规范化后打包成标准备份文件。
 * 即使数据已损坏，也会导出一份尽量干净的文件。
 */
export async function exportRescueBackup(): Promise<SaveResult> {
  const data = normalizeAppData(extractState(readRaw()))
  const content = exportData(data)
  const result = await saveBackupFile(backupFilename(), content)
  if (result !== 'cancelled') {
    markExported(data, summarizeData(data).checkinCount)
  }
  return result
}

// ---- 重载 / 清缓存 ----

/** 只重新加载页面 */
export function reloadPage(): void {
  window.location.replace(window.location.pathname)
}

/**
 * 强制更新：注销 Service Worker 并清空 Cache Storage 后重载。
 * 用于「旧 SW 吐出旧 JS」导致的白屏（改完代码但线上没生效的典型症状）。
 */
export async function hardReloadAndClearCache(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    // 不支持或已被拒绝：继续尝试清缓存
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // 忽略
  }
  window.location.replace(window.location.pathname)
}

// ---- 崩溃记录 ----

export interface CrashRecord {
  at: string
  message: string
  stack?: string
  componentStack?: string
}

export function readCrashes(): CrashRecord[] {
  try {
    const raw = localStorage.getItem(CRASH_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as CrashRecord[]) : []
  } catch {
    return []
  }
}

export function recordCrash(error: unknown, info?: ErrorInfo): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const record: CrashRecord = {
    at: new Date().toISOString(),
    message,
    stack: stack?.slice(0, 1200),
    componentStack: info?.componentStack?.slice(0, 1200),
  }
  try {
    const list = readCrashes()
    // React 捕获后同一个错误还会冒泡到 window.onerror，3 秒内同消息只记一次
    const last = list[0]
    if (last && last.message === message && Date.now() - new Date(last.at).getTime() < 3000) {
      return
    }
    localStorage.setItem(CRASH_KEY, JSON.stringify([record, ...list].slice(0, MAX_CRASHES)))
  } catch {
    // 记录失败不影响崩溃页展示
  }
}

export function clearCrashes(): void {
  try {
    localStorage.removeItem(CRASH_KEY)
  } catch {
    // 忽略
  }
}
