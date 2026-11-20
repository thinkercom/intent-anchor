import { cloud } from './cloud'
import { isCloudEnabled } from './cloudConfig'
import type { AppData } from '../store/types'

const TABLE = 'user_state'

interface Row {
  id: number
  owner_id: string
  master_key: string
  payload: AppData
  updated_at: string
}

/** 读取主账户的云端存档（RLS 保证只能读到自己 master_key 的） */
export async function fetchRemote(
  masterKey: string
): Promise<{ data: AppData | null; updatedAt: string | null; error?: string }> {
  if (!isCloudEnabled) return { data: null, updatedAt: null }
  const db = cloud.database as any
  const { data, error } = await db
    .from(TABLE)
    .select('id, payload, updated_at')
    .eq('master_key', masterKey)
    .maybeSingle()
  if (error) return { data: null, updatedAt: null, error: error.message }
  if (!data) return { data: null, updatedAt: null }
  const row = data as Row
  return { data: row.payload, updatedAt: row.updated_at }
}

/**
 * 首次登录：把本地数据上传为云端存档（归属 masterKey）。
 * 若云端已有记录（换设备 / 换登录方式），返回远端数据让本地采用。
 */
export async function uploadLocal(
  local: AppData,
  masterKey: string
): Promise<{ remote: AppData | null; error?: string }> {
  if (!isCloudEnabled) return { remote: null }
  const existing = await fetchRemote(masterKey)
  if (existing.error) return { remote: null, error: existing.error }
  if (existing.data) return { remote: existing.data }

  const db = cloud.database as any
  // owner_id / master_key 由前端显式写入（RLS 要求 master_key = auth.uid()）
  const { error } = await db.from(TABLE).insert({
    payload: local,
    master_key: masterKey,
  })
  if (error) return { remote: null, error: error.message }
  return { remote: null }
}

/** 写回云端：更新主账户的存档 */
export async function saveRemote(data: AppData, masterKey: string): Promise<{ error?: string }> {
  if (!isCloudEnabled) return {}
  const db = cloud.database as any
  const { data: rows, error } = await db
    .from(TABLE)
    .update({ payload: data, updated_at: new Date().toISOString() })
    .eq('master_key', masterKey)
    .select()
  if (error) return { error: error.message }
  if (!Array.isArray(rows) || rows.length === 0) {
    const ins = await db.from(TABLE).insert({ payload: data, master_key: masterKey })
    if (ins.error) return { error: ins.error.message }
  }
  return {}
}
