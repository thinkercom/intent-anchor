// /api/state  业务数据读写（身份隔离核心）
// GET  /api/state          -> { data, updatedAt }
// PUT  /api/state  { data } -> { ok, updatedAt }
// 安全：master_key 一律从会话 JWT 解析，绝不信任客户端传入的归属字段。
import { injectEnv } from '../_lib/config'
import { json, preflight, readBody } from '../_lib/http'
import { getSql } from '../_lib/db'
import { bearer, verifySession } from '../_lib/auth'

async function requireMaster(request: Request): Promise<{ mk: string } | { error: string; status: number }> {
  const token = bearer(request)
  if (!token) return { error: '未登录', status: 401 }
  const session = await verifySession(token)
  if (!session) return { error: '登录已过期，请重新登录', status: 401 }
  return { mk: session.mk }
}

export async function onRequestGet(context: { request: Request; env: unknown }): Promise<Response> {
  injectEnv(context.env)
  try {
    const auth = await requireMaster(context.request)
    if ('error' in auth) return json({ error: auth.error }, auth.status)

    const sql = getSql()
    const rows = (await sql`
      SELECT payload, updated_at FROM user_state WHERE master_key = ${auth.mk}
    `) as Array<{ payload: unknown; updated_at: string }>
    if (!rows.length) return json({ data: null, updatedAt: null })
    return json({ data: rows[0].payload, updatedAt: rows[0].updated_at })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `读取失败: ${msg}` }, 500)
  }
}

export async function onRequestPut(context: { request: Request; env: unknown }): Promise<Response> {
  injectEnv(context.env)
  try {
    const auth = await requireMaster(context.request)
    if ('error' in auth) return json({ error: auth.error }, auth.status)

    const body = await readBody<{ data?: unknown }>(context.request)
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return json({ error: '数据格式不正确' }, 400)
    }
    // 简单体积保护（Cloud Functions body 上限 6MB）
    const payloadStr = JSON.stringify(body.data)
    if (payloadStr.length > 4_000_000) return json({ error: '数据体积过大' }, 413)

    const sql = getSql()
    const now = new Date().toISOString()
    await sql`
      INSERT INTO user_state (master_key, owner_id, payload, updated_at)
      VALUES (${auth.mk}, ${auth.mk}, ${payloadStr}::jsonb, ${now})
      ON CONFLICT (master_key) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
    `
    return json({ ok: true, updatedAt: now })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `写入失败: ${msg}` }, 500)
  }
}

export function onRequestOptions(): Response {
  return preflight()
}
