// 会话 JWT（HS256）+ 验证码哈希 + 邮箱规范化。
// 用 Web Crypto（crypto.subtle），EdgeOne Node 20 运行时原生支持，无第三方依赖。
import { cfg } from './config'

const encoder = new TextEncoder()

function secret(): string {
  const s = cfg('JWT_SECRET')
  if (!s) throw new Error('JWT_SECRET 未配置')
  return s
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export interface SessionPayload {
  mk: string     // master_key（规范化邮箱）
  email: string  // 规范化邮箱
  prov: 'email' | 'wechat'
  iat: number
  exp: number
}

const SESSION_TTL = 30 * 24 * 3600 // 30 天

export async function signSession(input: {
  mk: string
  email: string
  prov: 'email' | 'wechat'
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { ...input, iat: now, exp: now + SESSION_TTL }
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signingInput = `${header}.${body}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(signingInput))
  return `${signingInput}.${toBase64Url(new Uint8Array(sig))}`
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const sigBytes = fromBase64Url(sig)
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      sigBytes.slice().buffer as ArrayBuffer,
      encoder.encode(`${header}.${body}`)
    )
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload
    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp || payload.exp < now) return null
    if (!payload.mk || !payload.email) return null
    return payload
  } catch {
    return null
  }
}

/** 从请求头提取 Bearer token */
export function bearer(request: Request): string | null {
  const h = request.headers.get('authorization') || ''
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1] : null
}

/** 邮箱规范化：去空格、转小写、基础格式校验，返回规范化邮箱或 null */
export function normalizeEmail(input: unknown): string | null {
  const email = String(input ?? '').trim().toLowerCase()
  if (!email || email.length > 254) return null
  // 单一 @，本地部分与域名部分都非空，域名含点且不含空格
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

/** 验证码哈希：HMAC-SHA256(code + ':' + email, JWT_SECRET)，不做可逆存储 */
export async function hashCode(code: string, email: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(`${code}:${email}`))
  return toBase64Url(new Uint8Array(sig))
}

/** 生成 6 位数字验证码 */
export function generateCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

/** 邮箱脱敏：thinker@example.com -> t***r@example.com */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length <= 2) return `${local.slice(0, 1)}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}
