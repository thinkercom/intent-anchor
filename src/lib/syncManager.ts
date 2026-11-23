import { useAppStore } from '../store/useAppStore'
import type { AppData } from '../store/types'
import { fetchRemote, uploadLocal, saveRemote } from './sync'

let writeTimer: number | null = null
let lastPushed: string | null = null
let enabled = false
let unsub: (() => void) | null = null
let currentMasterKey = ''

function snapshotKey(data: AppData): string {
  return JSON.stringify(data)
}

/** 启动数据变更监听：任何本地数据变化都自动防抖写回云端 */
export function startAutoSync(): void {
  if (unsub) return
  unsub = useAppStore.subscribe((state, prev) => {
    if (!enabled || !state.authUser || !currentMasterKey) return
    if (
      state.intents === prev.intents &&
      state.intentDone === prev.intentDone &&
      state.intentPresets === prev.intentPresets &&
      state.customPrompts === prev.customPrompts &&
      state.habits === prev.habits &&
      state.checkins === prev.checkins &&
      state.rewards === prev.rewards &&
      state.telemetry === prev.telemetry
    ) {
      return
    }
    schedulePush()
  })
}

/** 把当前本地数据写回云端（防抖）。仅在已登录时生效。 */
export function schedulePush(): void {
  if (!enabled || !currentMasterKey) return
  const state = useAppStore.getState()
  if (!state.authUser) return
  const data = state.getDataSnapshot()
  const key = snapshotKey(data)
  if (key === lastPushed) return
  state.setSyncStatus('syncing')
  if (writeTimer !== null) window.clearTimeout(writeTimer)
  writeTimer = window.setTimeout(async () => {
    const masterKey = currentMasterKey
    const payload = useAppStore.getState().getDataSnapshot()
    const result = await saveRemote(payload, masterKey)
    if (result.error) {
      useAppStore.getState().setSyncStatus('error', result.error)
    } else {
      lastPushed = snapshotKey(payload)
      useAppStore.getState().setSyncStatus('saved')
    }
  }, 800)
}

/**
 * 登录成功后编排（masterKey = 主账户键）：
 * 1. 若云端有存档 → 采用云端数据覆盖本地（换设备 / 换登录方式同步）
 * 2. 若云端无存档 → 把本地数据上传（首次登录迁移，不丢数据）
 */
export async function onSignedIn(masterKey: string): Promise<void> {
  enabled = true
  currentMasterKey = masterKey
  startAutoSync()
  const state = useAppStore.getState()
  state.setSyncStatus('syncing')

  const local = state.getDataSnapshot()
  const result = await uploadLocal(local, masterKey)

  if (result.error) {
    useAppStore.getState().setSyncStatus('error', result.error)
    return
  }
  if (result.remote) {
    window.setTimeout(() => {
      useAppStore.getState().applyRemoteData(result.remote as AppData)
      lastPushed = snapshotKey(result.remote as AppData)
      useAppStore.getState().setSyncStatus('saved')
    }, 120)
    return
  }
  lastPushed = snapshotKey(local)
  useAppStore.getState().setSyncStatus('saved')
}

/** 登出：停止同步 */
export function onSignedOut(): void {
  enabled = false
  currentMasterKey = ''
  if (writeTimer !== null) {
    window.clearTimeout(writeTimer)
    writeTimer = null
  }
  lastPushed = null
}

/** 拉取云端数据（供手动"从云端刷新"使用） */
export async function refreshFromCloud(): Promise<{ error?: string }> {
  if (!currentMasterKey) return {}
  const result = await fetchRemote(currentMasterKey)
  if (result.error) return { error: result.error }
  if (result.data) {
    window.setTimeout(() => {
      useAppStore.getState().applyRemoteData(result.data as AppData)
      lastPushed = snapshotKey(result.data as AppData)
    }, 120)
  }
  return {}
}
