// 邮箱验证码发送（QQ 邮箱 SMTP，nodemailer）。
// 依赖环境变量：SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
// 这是唯一的发信出口：日后若 EdgeOne 限制 SMTP 端口，只需替换本文件的 sendCodeMail 实现
// 为 HTTP 邮件 API（如 Resend），其余业务代码无需改动。
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { cfg } from './config'

let cached: { key: string; transporter: Transporter } | null = null

function buildTransporter(): { transporter: Transporter; from: string } {
  const host = cfg('SMTP_HOST') || 'smtp.qq.com'
  const portRaw = cfg('SMTP_PORT') || '465'
  const port = Number(portRaw) || 465
  const user = cfg('SMTP_USER')
  const pass = cfg('SMTP_PASS')
  const from = cfg('SMTP_FROM') || user

  const missing = [
    !user && 'SMTP_USER',
    !pass && 'SMTP_PASS',
  ].filter(Boolean)
  if (missing.length) throw new Error(`邮件服务未配置: ${missing.join(', ')}`)

  const key = `${host}:${port}:${user}`
  if (cached && cached.key === key) return { transporter: cached.transporter, from }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,          // 465 走 SSL；587 走 STARTTLS
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 15_000,
  })
  cached = { key, transporter }
  return { transporter, from }
}

function mailHtml(code: string): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2b2a28;">
    <p style="font-size:20px;font-weight:600;margin:0 0 8px;">意图锚点</p>
    <p style="font-size:14px;color:#6b6862;line-height:1.7;margin:0 0 24px;">你正在登录你的账户，请在应用内输入下面的验证码：</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f4f2ec;border-radius:12px;margin:0 0 20px;">${code}</div>
    <p style="font-size:12px;color:#9a968e;line-height:1.6;margin:0;">验证码 5 分钟内有效。若不是你本人操作，请忽略这封邮件。</p>
  </div>`
}

/** 发送 6 位登录验证码到指定邮箱 */
export async function sendCodeMail(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { transporter, from } = buildTransporter()
    await transporter.sendMail({
      from,
      to: email,
      subject: '【意图锚点】你的登录验证码',
      text: `你的登录验证码是 ${code}，5 分钟内有效。若不是你本人操作，请忽略。`,
      html: mailHtml(code),
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `邮件发送失败: ${msg}` }
  }
}
