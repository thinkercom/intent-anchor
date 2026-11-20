import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'
import { cloudConfig, isCloudEnabled } from './cloudConfig'
import type { AuthUser, LoginProvider } from '../store/useAppStore'

type CloudClient = ReturnType<typeof createWorkBuddyCloud>

// 单一云客户端实例，全局复用（auth / database 共用同一环境）。
// 阶段 A 的 EdgeOne 静态版默认游客模式，不在非 WorkBuddy 域名下创建云客户端。
const createdCloud = isCloudEnabled
  ? createWorkBuddyCloud({
      endpoint: cloudConfig.endpoint,
      oauthRelayBaseUrl: cloudConfig.oauthRelayBaseUrl,
      publishableKey: cloudConfig.publishableKey,
    })
  : null

export const cloud = createdCloud as CloudClient

const GUEST_MODE_ERROR = '当前为静态游客版，云登录将在数据库接入后开放'

const TABLE = 'account_identity'
const PENDING_BIND_KEY = 'intent_anchor_pending_wechat_bind'

/** 手机号发码前的校验（大陆 11 位） */
export function isValidPhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone)
}

/** 手机号规范化为 +86 前缀（SDK 内部也会做，这里用于展示与映射键对齐） */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `+86${digits.slice(-11)}`
}

/**
 * 第 1 步：发送短信验证码。
 * isExistingUser 决定后续 verifyOtp 的入参，challenge 需暂存到模块级变量。
 */
let pendingPhoneOtp: { phone: string; verificationId: string; isExistingUser: boolean } | null = null

export async function sendPhoneCode(phone: string): Promise<{ error?: string }> {
  if (!isCloudEnabled) return { error: GUEST_MODE_ERROR }
  if (!isValidPhone(phone)) return { error: '请输入正确的 11 位手机号' }
  const sent = await cloud.auth.sendOtp({ phone })
  if (sent.error) return { error: sent.error.message }
  pendingPhoneOtp = { phone, ...sent.data }
  return {}
}

/**
 * 第 2 步：验证验证码并完成手机号登录。
 * 成功后确保 account_identity 里存在 (phoneUid → phoneUid, 'phone') 映射，
 * 因为 RLS 要求 master_key = auth.uid() 才能写入自己的映射。
 */
export async function signInWithPhone(
  code: string
): Promise<{ user: AuthUser | null; error?: string; justBound?: boolean }> {
  if (!isCloudEnabled) return { user: null, error: GUEST_MODE_ERROR }
  const pending = pendingPhoneOtp
  if (!pending) return { user: null, error: '请先获取验证码' }
  if (!/^\d{4,8}$/.test(code)) return { user: null, error: '请输入正确的验证码' }

  const completed = await cloud.auth.verifyOtp({
    phone: pending.phone,
    verificationId: pending.verificationId,
    isExistingUser: pending.isExistingUser,
    token: code,
  })
  if (completed.error) return { user: null, error: completed.error.message }
  pendingPhoneOtp = null

  const session = completed.data
  const uid = session.user.id
  const db = cloud.database as any

  // 手机号登录：master_key 就是自己的 uid，插入自己的映射（幂等）
  const { error: mapErr } = await db.from(TABLE).upsert(
    { uid, master_key: uid, provider: 'phone', verified: true },
    { onConflict: 'uid' }
  )
  if (mapErr) return { user: null, error: mapErr.message }

  // 绑定模式：手机号验证成功后，当前会话就是手机号 uid，
  // 把之前微信授权拿到的 wechatUid 挂到本主账户（RLS: master_key = auth.uid() 成立）。
  const pendingWechatUid = localStorage.getItem(PENDING_BIND_KEY)
  let justBound = false
  if (pendingWechatUid && pendingWechatUid !== uid) {
    const { error: bindErr } = await db.from(TABLE).upsert(
      { uid: pendingWechatUid, master_key: uid, provider: 'wechat', verified: true },
      { onConflict: 'uid' }
    )
    if (bindErr) return { user: null, error: bindErr.message }
    localStorage.removeItem(PENDING_BIND_KEY)
    justBound = true
  }

  const user = await resolveAuthUser(uid, 'phone', session.user.phone)
  return { user, justBound }
}

/** 记录微信授权回调拿到的待绑定 uid（跨 OAuth 跳转保存） */
export function setPendingWechatBind(wechatUid: string): void {
  localStorage.setItem(PENDING_BIND_KEY, wechatUid)
}

/** 读取待绑定 uid */
export function getPendingWechatBind(): string | null {
  return localStorage.getItem(PENDING_BIND_KEY)
}

/** 发起微信登录：signInWithOAuth 只返回 URL，这里负责跳转（携带 sharecode） */
export async function signInWithWechat(): Promise<{ error?: string }> {
  if (!isCloudEnabled) return { error: GUEST_MODE_ERROR }
  const { data, error } = await cloud.auth.signInWithOAuth({
    provider: 'wechat',
    redirectTo: buildRedirectUrl(),
  })
  if (error) return { error: error.message }
  if (data?.url) {
    location.assign(data.url)
    return {}
  }
  return { error: '未获取到登录地址，请稍后重试' }
}

/**
 * 发起「绑定微信」：与登录共用 OAuth，URL 里留 binding=1 标记。
 * 绑定流程：微信授权 → 回调拿到微信 uid → 用手机号验证码确认本人 →
 * 在手机号会话下把 wechatUid 写入主账户映射（RLS 要求 master_key = auth.uid()）。
 * 这样安全（手机号验证证明本人）且无需 SDK 会话切换。
 */
export async function bindWechat(): Promise<{ error?: string }> {
  if (!isCloudEnabled) return { error: GUEST_MODE_ERROR }
  const { data, error } = await cloud.auth.signInWithOAuth({
    provider: 'wechat',
    redirectTo: buildRedirectUrl(true),
  })
  if (error) return { error: error.message }
  if (data?.url) {
    location.assign(data.url)
    return {}
  }
  return { error: '未获取到授权地址，请稍后重试' }
}

/** 解绑微信：删除当前主账户下的 wechat 映射（在手机号会话下操作） */
export async function unbindWechat(masterKey: string): Promise<{ error?: string }> {
  if (!isCloudEnabled) return { error: GUEST_MODE_ERROR }
  const db = cloud.database as any
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq('master_key', masterKey)
    .eq('provider', 'wechat')
  return error ? { error: error.message } : {}
}

/**
 * 解析当前 uid 对应的主账户信息。
 * - 手机号 uid：映射 (uid → uid)
 * - 微信 uid：映射 (wechatUid → masterKey)
 * 若查不到映射（例如旧微信扫码用户），回退为 master_key = uid（旧格式数据 owner_id = uid 仍可读）。
 */
export async function resolveAuthUser(
  uid: string,
  provider: LoginProvider,
  phone?: string | null
): Promise<AuthUser> {
  const db = cloud.database as any
  const { data } = await db.from(TABLE).select('master_key, provider').eq('uid', uid).maybeSingle()
  const masterKey: string = data?.master_key || uid

  // 查询该主账户下是否已挂载微信
  const { data: wechatRows } = await db
    .from(TABLE)
    .select('uid')
    .eq('master_key', masterKey)
    .eq('provider', 'wechat')
  const linkedWechat = Array.isArray(wechatRows) && wechatRows.length > 0

  return {
    id: uid,
    name: phone ? maskPhone(phone) : undefined,
    masterKey,
    provider,
    phone: phone ?? null,
    linkedWechat,
  }
}

/** 微信回调时：把微信 uid 挂到指定主账户（binding=1 流程） */
export async function attachWechatToMaster(
  wechatUid: string,
  masterKey: string
): Promise<{ error?: string }> {
  if (!isCloudEnabled) return { error: GUEST_MODE_ERROR }
  const db = cloud.database as any
  // RLS 要求 master_key = auth.uid()；绑定场景下当前会话仍是手机号，
  // 因此只有当 masterKey === 当前手机号 uid 时才能写入（RLS 自动保证）。
  const { error } = await db.from(TABLE).upsert(
    { uid: wechatUid, master_key: masterKey, provider: 'wechat', verified: true },
    { onConflict: 'uid' }
  )
  return error ? { error: error.message } : {}
}

/**
 * 应用启动时：处理 OAuth 回调 + 恢复会话 + 解析主账户。
 * 必须在任何路由/登录门控之前执行。
 */
export async function restoreSession(): Promise<{
  user: AuthUser | null
  error?: string
  needBindConfirm?: boolean   // 微信授权回调后，等待手机号验证确认
}> {
  if (!isCloudEnabled) return { user: null }
  const url = new URL(location.href)

  // 有回调参数：先处理微信回调
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    const provider = url.searchParams.get('provider')
    const isBinding = url.searchParams.get('binding') === '1'

    if (provider === 'wechat') {
      const { data: session, error } = await cloud.auth.handleWechatWebCallback()
      if (error) return { user: null, error: error.message }
      const wechatUid = session?.user?.id

      // 清理一次性参数（保留 sharecode 等应用自己的参数）
      for (const k of ['code', 'state', 'provider', 'binding']) url.searchParams.delete(k)
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)

      if (isBinding && wechatUid) {
        // 绑定模式：保存微信 uid，回到应用后弹出手机号验证完成绑定
        setPendingWechatBind(wechatUid)
        return { user: null, needBindConfirm: true }
      }
      if (wechatUid) {
        // 微信登录：解析出主账户，一键直达
        const user = await resolveAuthUser(wechatUid, 'wechat')
        return { user }
      }
    } else {
      // 非微信回调参数：清理后按普通访问处理
      for (const k of ['code', 'state', 'provider', 'binding']) url.searchParams.delete(k)
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  // 普通访问：恢复已有会话
  const { data: session, error } = await cloud.auth.getSession()
  if (error) return { user: null, error: error.message }
  if (session?.user) {
    // 判断当前 provider：从映射表看 uid 对应的 provider
    const db = cloud.database as any
    const { data: row } = await db.from(TABLE).select('provider').eq('uid', session.user.id).maybeSingle()
    const provider: LoginProvider = row?.provider === 'wechat' ? 'wechat' : 'phone'
    const user = await resolveAuthUser(session.user.id, provider, session.user.phone)
    return { user }
  }
  return { user: null }
}

/** 登出 */
export async function signOut(): Promise<{ error?: string }> {
  if (!isCloudEnabled) return { error: GUEST_MODE_ERROR }
  const { error } = await cloud.auth.signOut()
  return error ? { error: error.message } : {}
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`
  return phone
}

/** 构造 OAuth 回调地址：站点根路径 + 保留 sharecode 等应用参数 */
function buildRedirectUrl(binding = false): string {
  const current = new URL(location.href)
  const target = new URL(location.origin)
  for (const [key, value] of current.searchParams) {
    if (['code', 'state', 'provider', 'error', 'binding'].includes(key)) continue
    target.searchParams.set(key, value)
  }
  if (binding) target.searchParams.set('binding', '1')
  return target.toString()
}
