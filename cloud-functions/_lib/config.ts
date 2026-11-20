// 环境变量统一读取：优先 context.env（EdgeOne 注入），兜底 process.env。
// context.env 在不同运行时可能是对象或 getter，这里做兼容归一化。
const KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
] as const

const injected: Record<string, string> = {}

export function injectEnv(env: unknown): void {
  if (!env || typeof env !== 'object') return
  const source = env as Record<string, unknown>
  for (const key of KEYS) {
    let value = source[key]
    if (typeof value === 'function') {
      try { value = (value as () => unknown)() } catch { value = undefined }
    }
    if (typeof value === 'string' && value) injected[key] = value
  }
}

export function cfg(key: (typeof KEYS)[number] | string): string {
  if (injected[key]) return injected[key]
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key] as string
  return ''
}
