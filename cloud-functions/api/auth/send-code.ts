// POST /api/auth/send-code  发送手机号验证码
// body: { phone: "13800138000" }
import { injectEnv } from '../../_lib/config'
import { json, preflight, readBody } from '../../_lib/http'
import { getSql } from '../../_lib/db'
import { normalizePhone, hashCode, generateCode } from '../../_lib/auth'
import { sendSms } from '../../_lib/sms'

export async function onRequestPost(context: { request: Request; env: unknown }): Promise<Response> {
  injectEnv(context.env)
  try {
    const body = await readBody<{ phone?: string }>(context.request)
    const phone = normalizePhone(body.phone)
    if (!phone) return json({ error: '请输入正确的 11 位手机号' }, 400)

    const sql = getSql()
    // 频控：60 秒内重复发送直接拒绝（沿用上次验证码）
    const recent = (await sql`
      SELECT created_at FROM phone_otp WHERE phone = ${phone}
    `) as Array<{ created_at: string }>
    if (recent.length) {
      const elapsed = Date.now() - new Date(recent[0].created_at).getTime()
      if (elapsed < 60_000) return json({ error: '发送过于频繁，请稍后再试' }, 429)
    }

    const code = generateCode()
    const codeHash = await hashCode(code, phone)
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()

    const sent = await sendSms(phone, code)
    if (!sent.ok) return json({ error: sent.error || '验证码发送失败' }, 502)

    // 发送成功后再落库（upsert），避免短信发出但记录写入失败导致无法验证
    await sql`
      INSERT INTO phone_otp (phone, code_hash, attempts, expires_at, created_at)
      VALUES (${phone}, ${codeHash}, 0, ${expiresAt}, now())
      ON CONFLICT (phone) DO UPDATE SET
        code_hash = EXCLUDED.code_hash,
        attempts = 0,
        expires_at = EXCLUDED.expires_at,
        created_at = now()
    `
    return json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `服务异常: ${msg}` }, 500)
  }
}

export function onRequestOptions(): Response {
  return preflight()
}
