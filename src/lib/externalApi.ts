// 自建云 API 客户端（EdgeOne Cloud Functions + Neon）。
// 仅存会话 token（不含任何云端密钥）；所有数据归属由服务端从 token 推导。
import type { AppData } from '../store/types'
import type { AuthUser } from '../store/useAppStore'

const TOKEN_KEY = 'intent_anchor_session_token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* 隐私模式下忽略 */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T | null; error?: string }> {
  let res: Response
  try {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) }
    if (token) headers.Authorization = `Bearer ${token}`
    res = await fetch(path, { ...init, headers })
  } catch (e) {
    return { data: null, error: `网络请求失败：${e instanceof Error ? e.message : String(e)}` }
  }
  let body: unknown
  try { body = await res.json() } catch { return { data: null, error: '服务返回了无效响应' } }
  const obj = body as Record<string, unknown>
  if (!res.ok) return { data: null, error: String(obj.error || `请求失败 (${res.status})`) }
  return { data: body as T }
}

export async function extSendCode(phone: string): Promise<{ error?: string }> {
  const { error } = await request<{ ok: boolean }>('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
  return error ? { error } : {}
}

export async function extVerifyCode(phone: string, code: string): Promise<{
  user: AuthUser | null
  error?: string
}> {
  const { data, error } = await request<{ token: string; user: AuthUser }>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
  if (error || !data) return { user: null, error: error || '验证失败' }
  setToken(data.token)
  return { user: data.user }
}

export async function extGetSession(): Promise<{ user: AuthUser | null; error?: string }> {
  if (!getToken()) return { user: null }
  const { data, error } = await request<{ user: AuthUser | null }>('/api/auth/session')
  if (error) return { user: null, error }
  return { user: data?.user ?? null }
}

export function extSignOut(): void {
  clearToken()
}

export async function extFetchState(): Promise<{
  data: AppData | null
  updatedAt: string | null
  error?: string
}> {
  const { data, error } = await request<{ data: AppData | null; updatedAt: string | null }>('/api/state')
  if (error) return { data: null, updatedAt: null, error }
  return { data: data?.data ?? null, updatedAt: data?.updatedAt ?? null }
}

export async function extSaveState(payload: AppData): Promise<{ error?: string }> {
  const { error } = await request<{ ok: boolean }>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ data: payload }),
  })
  return error ? { error } : {}
}
