// POST /api/auth/verify  校验验证码并登录/注册（手机号即主账户）
// body: { phone: "13800138000", code: "123456" }
// 返回: { token, user: { id, masterKey, phone, provider, name, linkedWechat } }
import { injectEnv } from '../../_lib/config'
import { json, preflight, readBody } from '../../_lib/http'
import { getSql } from '../../_lib/db'
import { normalizePhone, hashCode, signSession, maskPhone } from '../../_lib/auth'

interface OtpRow {
  phone: string
  code_hash: string
  attempts: number
  expires_at: string
}

export async function onRequestPost(context: { request: Request; env: unknown }): Promise<Response> {
  injectEnv(context.env)
  try {
    const body = await readBody<{ phone?: string; code?: string }>(context.request)
    const phone = normalizePhone(body.phone)
    const code = String(body.code ?? '').replace(/\D/g, '')
    if (!phone) return json({ error: '请输入正确的 11 位手机号' }, 400)
    if (!/^\d{6}$/.test(code)) return json({ error: '请输入 6 位验证码' }, 400)

    const sql = getSql()
    const rows = (await sql`SELECT phone, code_hash, attempts, expires_at FROM phone_otp WHERE phone = ${phone}`) as OtpRow[]
    const row = rows[0]
    if (!row) return json({ error: '请先获取验证码' }, 400)

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await sql`DELETE FROM phone_otp WHERE phone = ${phone}`
      return json({ error: '验证码已过期，请重新获取' }, 400)
    }
    if (row.attempts >= 5) {
      await sql`DELETE FROM phone_otp WHERE phone = ${phone}`
      return json({ error: '尝试次数过多，请重新获取验证码' }, 400)
    }

    const suppliedHash = await hashCode(code, phone)
    if (suppliedHash !== row.code_hash) {
      await sql`UPDATE phone_otp SET attempts = attempts + 1 WHERE phone = ${phone}`
      return json({ error: '验证码不正确' }, 400)
    }

    // 验证通过：删除验证码，建立/确认主账户映射（master_key = 规范化手机号）
    await sql`DELETE FROM phone_otp WHERE phone = ${phone}`
    const uid = phone // 手机号主账户：uid 与 master_key 相同
    const masterKey = phone
    await sql`
      INSERT INTO account_identity (uid, master_key, provider, verified, created_at)
      VALUES (${uid}, ${masterKey}, 'phone', true, now())
      ON CONFLICT (uid) DO UPDATE SET verified = true
    `

    // 查询该主账户下是否已挂载微信
    const wechat = (await sql`
      SELECT uid FROM account_identity
      WHERE master_key = ${masterKey} AND provider = 'wechat' AND verified = true
      LIMIT 1
    `) as Array<{ uid: string }>

    const token = await signSession({ mk: masterKey, phone, prov: 'phone' })
    return json({
      token,
      user: {
        id: uid,
        masterKey,
        phone: maskPhone(phone),
        provider: 'phone',
        name: maskPhone(phone),
        linkedWechat: wechat.length > 0,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `服务异常: ${msg}` }, 500)
  }
}

export function onRequestOptions(): Response {
  return preflight()
}
