// Neon serverless 客户端（HTTP 查询，无 WebSocket）。
// 每个请求内复用 neon() 查询函数；它是无状态的，可安全在模块级缓存。
import { neon } from '@neondatabase/serverless'
import { cfg } from './config'

let cachedUrl = ''
let cachedSql: ReturnType<typeof neon> | null = null

export function getSql(): ReturnType<typeof neon> {
  const url = cfg('DATABASE_URL')
  if (!url) throw new Error('DATABASE_URL 未配置')
  if (!cachedSql || cachedUrl !== url) {
    cachedSql = neon(url)
    cachedUrl = url
  }
  return cachedSql
}
