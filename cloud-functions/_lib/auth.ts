// 会话 JWT（HS256）+ 验证码哈希 + 手机号规范化。
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
  mk: string    // master_key（规范化手机号）
  phone: string // 规范化手机号
  prov: 'phone' | 'wechat'
  iat: number
  exp: number
}

const SESSION_TTL = 30 * 24 * 3600 // 30 天

export async function signSession(input: {
  mk: string
  phone: string
  prov: 'phone' | 'wechat'
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
    if (!payload.mk || !payload.phone) return null
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

/** 手机号规范化：只接受大陆 11 位，输出 +86xxxxxxxxxxx */
export function normalizePhone(input: unknown): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (!/^1\d{10}$/.test(digits)) return null
  return `+86${digits}`
}

/** 验证码哈希：HMAC-SHA256(code + ':' + phone, JWT_SECRET)，不做可逆存储 */
export async function hashCode(code: string, phone: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(`${code}:${phone}`))
  return toBase64Url(new Uint8Array(sig))
}

/** 生成 6 位数字验证码 */
export function generateCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

/** 手机号脱敏：兼容 +86 前缀，输出 138****8000 */
export function maskPhone(phone: string): string {
  let d = phone.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('86')) d = d.slice(2) // 去掉国家码
  if (d.length === 11) return `${d.slice(0, 3)}****${d.slice(-4)}`
  if (d.length >= 7) return `${d.slice(0, 3)}****${d.slice(-4)}`
  return phone
}
