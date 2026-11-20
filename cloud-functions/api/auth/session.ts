// GET /api/auth/session  用 token 恢复会话（应用启动时调用）
// header: Authorization: Bearer <token>
// 返回: { user: AuthUser | null }
import { injectEnv } from '../../_lib/config'
import { json, preflight } from '../../_lib/http'
import { bearer, verifySession, maskEmail } from '../../_lib/auth'

export async function onRequestGet(context: { request: Request; env: unknown }): Promise<Response> {
  injectEnv(context.env)
  try {
    const token = bearer(context.request)
    if (!token) return json({ user: null })
    const session = await verifySession(token)
    if (!session) return json({ user: null })
    const masked = session.email ? maskEmail(session.email) : null
    return json({
      user: {
        id: session.mk,
        masterKey: session.mk,
        email: masked,
        provider: session.prov,
        name: masked ?? undefined,
        linkedWechat: false, // 会话恢复时不查库，微信挂载状态以本地持久化的 authUser 为准
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ user: null, error: msg }, 500)
  }
}

export function onRequestOptions(): Response {
  return preflight()
}
